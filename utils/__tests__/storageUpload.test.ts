import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeXhr, type FakeResponse, type RecordedRequest } from './fakeXhr';
import { BlobUploadAbortedError, BlobUploadError, SINGLE_SHOT_LIMIT } from '../blockBlobUpload';
import { selectUploadProtocol, uploadToSignedTarget } from '../storageUpload';
import { uploadS3Multipart, type S3MultipartApi } from '../s3MultipartUpload';

const MiB = 1024 * 1024;
const PART = 16 * MiB;

const makeFile = (size: number, type = 'video/mp4') => new File([new Uint8Array(size)], 'x.mp4', { type });

// One shared large file: 70 MiB -> 5 parts of 16 MiB (last one 6 MiB).
const LARGE_SIZE = 70 * MiB;
const LARGE_PARTS = Math.ceil(LARGE_SIZE / PART);
let largeFile: File;

const partUrl = (n: number, generation = 1) => `https://bucket.s3.us-east-1.amazonaws.com/k?partNumber=${n}&uploadId=u1&gen=${generation}`;
const partOf = (url: string) => Number(new URL(url).searchParams.get('partNumber'));

interface FakeApi extends S3MultipartApi {
  calls: { create: unknown[]; getPartUrls: number[][]; complete: unknown[]; abort: unknown[] };
}

const makeApi = (overrides: Partial<S3MultipartApi> = {}, partSize = PART): FakeApi => {
  const calls: FakeApi['calls'] = { create: [], getPartUrls: [], complete: [], abort: [] };
  const generation = new Map<number, number>();
  const api: FakeApi = {
    calls,
    create: async (request) => {
      calls.create.push(request);
      return {
        uploadId: 'u1',
        key: request.key,
        partSize,
        partCount: Math.ceil(request.size / partSize),
      };
    },
    getPartUrls: async (_uploadId, _key, partNumbers) => {
      calls.getPartUrls.push(partNumbers);
      return partNumbers.map((partNumber) => {
        const gen = (generation.get(partNumber) ?? 0) + 1;
        generation.set(partNumber, gen);
        return { partNumber, url: partUrl(partNumber, gen) };
      });
    },
    complete: async (_uploadId, key, parts) => {
      calls.complete.push(parts);
      return { key };
    },
    abort: async (uploadId, key) => {
      calls.abort.push({ uploadId, key });
    },
    ...overrides,
  };
  return api;
};

const okWithEtag = (request: RecordedRequest): FakeResponse => ({
  status: 200,
  headers: { ETag: `"etag-${partOf(request.url)}"` },
});

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  largeFile ??= makeFile(LARGE_SIZE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selectUploadProtocol', () => {
  it('treats a missing provider as azure (old server)', () => {
    expect(selectUploadProtocol(undefined, 1)).toBe('azure-single');
    expect(selectUploadProtocol(null, 1)).toBe('azure-single');
    expect(selectUploadProtocol('', SINGLE_SHOT_LIMIT + 1)).toBe('azure-blocks');
  });

  it('switches at the 64 MiB single-PUT limit', () => {
    expect(selectUploadProtocol('azure', SINGLE_SHOT_LIMIT)).toBe('azure-single');
    expect(selectUploadProtocol('azure', SINGLE_SHOT_LIMIT + 1)).toBe('azure-blocks');
    expect(selectUploadProtocol('s3', SINGLE_SHOT_LIMIT)).toBe('s3-single');
    expect(selectUploadProtocol('s3', SINGLE_SHOT_LIMIT + 1)).toBe('s3-multipart');
  });

  it('rejects an unknown provider instead of guessing', () => {
    expect(() => selectUploadProtocol('gcs', 1)).toThrow(BlobUploadError);
  });
});

describe('uploadToSignedTarget: Azure / old server', () => {
  it('old server, small file: one PUT with the same headers as before', async () => {
    FakeXhr.reset(() => ({ status: 201 }));
    const file = makeFile(1000, 'application/pdf');
    const progress: number[] = [];

    const result = await uploadToSignedTarget(
      { uploadUrl: 'https://acct.blob.core.windows.net/c/p.pdf?sv=1&sig=a', uploadPath: 'course-resources/p.pdf' },
      file,
      { onProgress: (b) => progress.push(b) },
    );

    expect(result).toEqual({ key: 'course-resources/p.pdf' });
    expect(FakeXhr.requests).toHaveLength(1);
    expect(FakeXhr.requests[0]).toMatchObject({
      method: 'PUT',
      url: 'https://acct.blob.core.windows.net/c/p.pdf?sv=1&sig=a',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/pdf' },
    });
    expect(progress.at(-1)).toBe(1000);
  });

  it('old server, large file: Azure Put Block + Put Block List, untouched', async () => {
    FakeXhr.reset(() => ({ status: 201 }));
    await uploadToSignedTarget(
      { uploadUrl: 'https://acct.blob.core.windows.net/c/v.mp4?sig=a', uploadPath: 'course-resources/v.mp4' },
      largeFile,
    );
    const blocks = FakeXhr.requests.filter((r) => r.url.includes('comp=block&'));
    const list = FakeXhr.requests.filter((r) => r.url.includes('comp=blocklist'));
    expect(blocks).toHaveLength(Math.ceil(LARGE_SIZE / (8 * MiB)));
    expect(list).toHaveLength(1);
    expect(list[0].headers['x-ms-blob-content-type']).toBe('video/mp4');
  });

  it('azure with uploadHeaders: sends exactly those on the single PUT', async () => {
    FakeXhr.reset(() => ({ status: 201 }));
    const headers = { 'Content-Type': 'application/pdf', 'x-ms-blob-type': 'BlockBlob' };
    await uploadToSignedTarget(
      { uploadUrl: 'https://acct.blob.core.windows.net/c/p?sig=a', uploadPath: 'p', provider: 'azure', uploadHeaders: headers },
      makeFile(10, 'application/octet-stream'),
    );
    expect(FakeXhr.requests[0].headers).toEqual(headers);
  });
});

describe('uploadToSignedTarget: S3', () => {
  it('small file: one PUT to the presigned URL with exactly uploadHeaders', async () => {
    FakeXhr.reset(() => ({ status: 200, headers: { ETag: '"e"' } }));
    const api = makeApi();
    const result = await uploadToSignedTarget(
      {
        uploadUrl: 'https://b.s3.us-east-1.amazonaws.com/course-resources/p.pdf?X-Amz-Signature=s',
        uploadPath: 'course-resources/p.pdf',
        provider: 's3',
        uploadHeaders: { 'Content-Type': 'application/pdf' },
      },
      makeFile(2048, 'application/pdf'),
      { multipartApi: api },
    );
    expect(result).toEqual({ key: 'course-resources/p.pdf' });
    expect(FakeXhr.requests).toHaveLength(1);
    expect(FakeXhr.requests[0].headers).toEqual({ 'Content-Type': 'application/pdf' });
    expect(api.calls.create).toHaveLength(0);
  });

  it('large file: create -> part URLs -> PUT parts -> complete with ETags', async () => {
    FakeXhr.reset((request) => ({ ...okWithEtag(request), delayMs: 5 }));
    const api = makeApi();
    const progress: number[] = [];

    const result = await uploadToSignedTarget(
      { uploadUrl: 'https://unused', uploadPath: 'course-resources/v.mp4', provider: 's3', uploadHeaders: { 'Content-Type': 'video/mp4' } },
      largeFile,
      { multipartApi: api, onProgress: (b) => progress.push(b) },
    );

    expect(result).toEqual({ key: 'course-resources/v.mp4' });
    expect(api.calls.create).toEqual([{ key: 'course-resources/v.mp4', contentType: 'video/mp4', size: LARGE_SIZE }]);
    expect(api.calls.getPartUrls.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(FakeXhr.requests).toHaveLength(LARGE_PARTS);
    expect(FakeXhr.requests.every((r) => r.method === 'PUT' && Object.keys(r.headers).length === 0)).toBe(true);
    expect(FakeXhr.requests.map((r) => r.bodySize).sort((a, b) => a - b)).toEqual([6 * MiB, PART, PART, PART, PART]);
    expect(FakeXhr.maxInFlight).toBeLessThanOrEqual(4);
    expect(FakeXhr.maxInFlight).toBeGreaterThan(1);
    expect(api.calls.complete).toEqual([
      [1, 2, 3, 4, 5].map((partNumber) => ({ partNumber, etag: `"etag-${partNumber}"` })),
    ]);
    expect(api.calls.abort).toHaveLength(0);
    // progress never goes backwards past a finished part and ends at the full size
    expect(progress.at(-1)).toBe(LARGE_SIZE);
    expect(Math.max(...progress)).toBe(LARGE_SIZE);
  });

  it('large file without a multipart API is an error, not a silent single PUT', async () => {
    FakeXhr.reset(() => ({ status: 200 }));
    await expect(
      uploadToSignedTarget({ uploadUrl: 'https://u', uploadPath: 'k', provider: 's3' }, largeFile),
    ).rejects.toBeInstanceOf(BlobUploadError);
    expect(FakeXhr.requests).toHaveLength(0);
  });
});

describe('uploadS3Multipart', () => {
  const opts = { retryBaseDelayMs: 1 };

  it('retries a part after a transient failure', async () => {
    let failed = false;
    FakeXhr.reset((request) => {
      if (partOf(request.url) === 2 && !failed) {
        failed = true;
        return { status: 503, body: '<Error><Code>SlowDown</Code></Error>' };
      }
      return okWithEtag(request);
    });
    const api = makeApi();
    await uploadS3Multipart(api, 'k', largeFile, 'video/mp4', opts);
    expect(FakeXhr.requests.filter((r) => partOf(r.url) === 2)).toHaveLength(2);
    expect(api.calls.complete).toHaveLength(1);
  });

  it('retries a network error', async () => {
    let failed = false;
    FakeXhr.reset((request) => {
      if (partOf(request.url) === 5 && !failed) {
        failed = true;
        return { status: 0, networkError: true };
      }
      return okWithEtag(request);
    });
    const api = makeApi();
    await uploadS3Multipart(api, 'k', largeFile, 'video/mp4', opts);
    expect(api.calls.complete).toHaveLength(1);
  });

  it('gets a fresh URL for a part whose URL was rejected (expired)', async () => {
    FakeXhr.reset((request) => {
      const gen = new URL(request.url).searchParams.get('gen');
      if (partOf(request.url) === 3 && gen === '1') {
        return { status: 403, body: '<Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>' };
      }
      return okWithEtag(request);
    });
    const api = makeApi();
    await uploadS3Multipart(api, 'k', largeFile, 'video/mp4', opts);
    expect(api.calls.getPartUrls).toContainEqual([3]);
    const part3 = FakeXhr.requests.filter((r) => partOf(r.url) === 3);
    expect(part3.map((r) => new URL(r.url).searchParams.get('gen'))).toEqual(['1', '2']);
  });

  it('gives up after the retry budget, aborts, and never completes', async () => {
    FakeXhr.reset((request) =>
      partOf(request.url) === 4 ? { status: 500 } : okWithEtag(request),
    );
    const api = makeApi();
    await expect(
      uploadS3Multipart(api, 'k', largeFile, 'video/mp4', { ...opts, maxAttemptsPerPart: 3 }),
    ).rejects.toMatchObject({ name: 'BlobUploadError', status: 500 });
    expect(FakeXhr.requests.filter((r) => partOf(r.url) === 4)).toHaveLength(3);
    expect(api.calls.complete).toHaveLength(0);
    expect(api.calls.abort).toEqual([{ uploadId: 'u1', key: 'k' }]);
  });

  it('does not retry a client error such as 400', async () => {
    FakeXhr.reset((request) => (partOf(request.url) === 1 ? { status: 400 } : okWithEtag(request)));
    const api = makeApi();
    await expect(uploadS3Multipart(api, 'k', largeFile, 'video/mp4', opts)).rejects.toBeInstanceOf(BlobUploadError);
    expect(FakeXhr.requests.filter((r) => partOf(r.url) === 1)).toHaveLength(1);
    expect(api.calls.abort).toHaveLength(1);
  });

  it('fails with a CORS hint when the ETag header is not exposed', async () => {
    FakeXhr.reset(() => ({ status: 200 }));
    const api = makeApi();
    await expect(uploadS3Multipart(api, 'k', largeFile, 'video/mp4', opts)).rejects.toThrow(/ETag/);
    expect(api.calls.complete).toHaveLength(0);
    expect(api.calls.abort).toHaveLength(1);
  });

  it('cancel: stops in-flight parts, aborts the upload, throws BlobUploadAbortedError', async () => {
    const controller = new AbortController();
    FakeXhr.reset((request) => {
      if (FakeXhr.requests.length === 2) setTimeout(() => controller.abort(), 1);
      return { ...okWithEtag(request), delayMs: 50 };
    });
    const api = makeApi();
    await expect(
      uploadS3Multipart(api, 'k', largeFile, 'video/mp4', { ...opts, signal: controller.signal }),
    ).rejects.toBeInstanceOf(BlobUploadAbortedError);
    expect(api.calls.complete).toHaveLength(0);
    expect(api.calls.abort).toEqual([{ uploadId: 'u1', key: 'k' }]);
    expect(FakeXhr.inFlight).toBe(0);
  });

  it('cancel before start: nothing is created', async () => {
    FakeXhr.reset(okWithEtag);
    const controller = new AbortController();
    controller.abort();
    const api = makeApi();
    await expect(
      uploadS3Multipart(api, 'k', largeFile, 'video/mp4', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(BlobUploadAbortedError);
    expect(api.calls.create).toHaveLength(0);
  });

  it('rejects an inconsistent plan from the server and aborts it', async () => {
    FakeXhr.reset(okWithEtag);
    const api = makeApi({
      create: async (request) => ({ uploadId: 'u1', key: request.key, partSize: PART, partCount: 2 }),
    });
    await expect(uploadS3Multipart(api, 'k', largeFile, 'video/mp4', opts)).rejects.toBeInstanceOf(BlobUploadError);
    expect(FakeXhr.requests).toHaveLength(0);
    expect(api.calls.abort).toHaveLength(1);
  });

  it('fetches part URLs lazily in batches', async () => {
    FakeXhr.reset(okWithEtag);
    const api = makeApi();
    await uploadS3Multipart(api, 'k', largeFile, 'video/mp4', { ...opts, partUrlBatchSize: 2 });
    expect(api.calls.getPartUrls).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('commits under the key the server chose', async () => {
    FakeXhr.reset(okWithEtag);
    const api = makeApi({
      complete: async () => ({ key: 'course-resources/final.mp4' }),
    });
    await expect(uploadS3Multipart(api, 'k', largeFile, 'video/mp4', opts)).resolves.toEqual({
      key: 'course-resources/final.mp4',
    });
  });
});
