/**
 * Uploads a large file to S3 with multipart upload, using presigned part URLs
 * the Tests service hands out (STORAGE-S3-CONTRACT.md §5).
 *
 *   create -> fetch part URLs (in batches, as needed) -> PUT parts -> complete
 *
 * Parts go up a few at a time; each part is retried on transient failures,
 * and a part whose URL was rejected (expired) gets a fresh URL before its
 * retry. On any failure or cancel the upload is aborted server-side so S3
 * does not keep billing for orphaned parts.
 *
 * Never logs keys or file names: they can contain patient names.
 */
import { BlobUploadAbortedError, BlobUploadError, put, type PutResult } from './blockBlobUpload';

export interface S3MultipartCreateRequest {
  key: string;
  contentType: string;
  size: number;
}

export interface S3MultipartCreateResponse {
  uploadId: string;
  key: string;
  partSize: number;
  partCount: number;
}

export interface S3PartUrl {
  partNumber: number;
  url: string;
}

export interface S3CompletedPart {
  partNumber: number;
  etag: string;
}

/** The four test-service endpoints, bound to one resource owner (a course). */
export interface S3MultipartApi {
  create: (request: S3MultipartCreateRequest, signal?: AbortSignal) => Promise<S3MultipartCreateResponse>;
  getPartUrls: (
    uploadId: string,
    key: string,
    partNumbers: number[],
    signal?: AbortSignal,
  ) => Promise<S3PartUrl[]>;
  complete: (
    uploadId: string,
    key: string,
    parts: S3CompletedPart[],
    signal?: AbortSignal,
  ) => Promise<{ key: string }>;
  /** Called without the caller's signal: it must still run after a cancel. */
  abort: (uploadId: string, key: string) => Promise<void>;
}

export interface S3MultipartUploadOptions {
  /** Called with the number of bytes confirmed sent so far. */
  onProgress?: (uploadedBytes: number) => void;
  signal?: AbortSignal;
  /** Parts in flight at once. */
  concurrency?: number;
  /** Attempts per part, including the first. */
  maxAttemptsPerPart?: number;
  /** Delay before the first retry; doubles on each further retry. */
  retryBaseDelayMs?: number;
  /** How many part URLs to request per call. */
  partUrlBatchSize?: number;
}

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
// Presigned URLs live ~15 minutes by default, so fetch them close to use
// instead of all up front for a multi-gigabyte file.
const DEFAULT_PART_URL_BATCH = 8;

/** S3 rejects parts under 5 MiB (the last part excepted). */
const S3_MIN_PART_SIZE = 5 * 1024 * 1024;

const isRetryable = (error: unknown): boolean => {
  if (!(error instanceof BlobUploadError)) return false;
  const { status } = error;
  // 0: network failure; 403: usually an expired presigned URL (refreshed first).
  return status === 0 || status === 403 || status === 408 || status === 429 || status >= 500;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new BlobUploadAbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new BlobUploadAbortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new BlobUploadAbortedError();
};

/**
 * Pushes `file` to S3 via multipart upload under `key`. Resolves with the
 * final key once S3 has assembled the object; rejects with
 * BlobUploadAbortedError if the caller cancels.
 */
export const uploadS3Multipart = async (
  api: S3MultipartApi,
  key: string,
  file: File,
  contentType: string,
  options: S3MultipartUploadOptions = {},
): Promise<{ key: string }> => {
  const callerSignal = options.signal;
  // Parts share an internal signal so the first failed part can stop the
  // others instead of letting them finish uploading bytes nobody will use.
  const internal = new AbortController();
  const forwardAbort = () => internal.abort();
  if (callerSignal?.aborted) internal.abort();
  callerSignal?.addEventListener('abort', forwardAbort, { once: true });
  const signal = internal.signal;
  const cancelled = () => Boolean(callerSignal?.aborted);
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const maxAttempts = Math.max(1, options.maxAttemptsPerPart ?? DEFAULT_MAX_ATTEMPTS);
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const batchSize = Math.max(1, options.partUrlBatchSize ?? DEFAULT_PART_URL_BATCH);

  let session: S3MultipartCreateResponse;
  try {
    throwIfAborted(signal);
    session = await api.create({ key, contentType, size: file.size }, signal);
  } catch (error) {
    callerSignal?.removeEventListener('abort', forwardAbort);
    if (cancelled()) throw new BlobUploadAbortedError();
    throw error;
  }

  const { uploadId, partSize, partCount } = session;
  const uploadKey = session.key || key;

  const abortUpload = async () => {
    try {
      await api.abort(uploadId, uploadKey);
    } catch {
      // Best effort. The bucket's lifecycle rule for incomplete multipart
      // uploads is the backstop.
    }
  };

  try {
    const expectedParts = partSize > 0 ? Math.ceil(file.size / partSize) : NaN;
    if (
      !uploadId ||
      !Number.isFinite(expectedParts) ||
      expectedParts !== partCount ||
      (partCount > 1 && partSize < S3_MIN_PART_SIZE)
    ) {
      throw new BlobUploadError('The server returned an invalid upload plan. Try uploading again.', 0);
    }

    // Part URLs are fetched lazily in batches; concurrent workers that need
    // the same batch share one request.
    const urls = new Map<number, string>();
    const pending = new Map<number, Promise<void>>();
    const fetchBatch = (first: number): Promise<void> => {
      const existing = pending.get(first);
      if (existing) return existing;
      const partNumbers: number[] = [];
      for (let n = first; n < first + batchSize && n <= partCount; n += 1) partNumbers.push(n);
      const request = api
        .getPartUrls(uploadId, uploadKey, partNumbers, signal)
        .then((parts) => {
          parts.forEach(({ partNumber, url }) => urls.set(partNumber, url));
        })
        .finally(() => pending.delete(first));
      pending.set(first, request);
      return request;
    };
    const batchStart = (partNumber: number) =>
      Math.floor((partNumber - 1) / batchSize) * batchSize + 1;
    const urlFor = async (partNumber: number, refresh: boolean): Promise<string> => {
      if (refresh) {
        urls.delete(partNumber);
        const parts = await api.getPartUrls(uploadId, uploadKey, [partNumber], signal);
        parts.forEach((part) => urls.set(part.partNumber, part.url));
      } else if (!urls.has(partNumber)) {
        await fetchBatch(batchStart(partNumber));
      }
      const url = urls.get(partNumber);
      if (!url) {
        throw new BlobUploadError('The server did not return an upload link for every part.', 0);
      }
      return url;
    };

    // Progress is the sum of finished parts plus whatever the in-flight ones
    // have pushed, so the bar keeps moving inside a single large part.
    const settled = new Array<number>(partCount).fill(0);
    const inFlight = new Map<number, number>();
    const reportProgress = () => {
      if (!options.onProgress) return;
      let total = 0;
      settled.forEach((bytes) => {
        total += bytes;
      });
      inFlight.forEach((bytes) => {
        total += bytes;
      });
      options.onProgress(Math.min(total, file.size));
    };

    const etags = new Array<string>(partCount);

    const uploadPart = async (partNumber: number) => {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const chunk = file.slice(start, end);

      let refreshUrl = false;
      for (let attempt = 1; ; attempt += 1) {
        throwIfAborted(signal);
        let result: PutResult;
        try {
          const url = await urlFor(partNumber, refreshUrl);
          // No Content-Type: part URLs are not signed over one, and the
          // slice carries no type, so the browser sends none.
          result = await put({
            url,
            body: chunk,
            headers: {},
            signal,
            onProgress: (loaded) => {
              inFlight.set(partNumber, loaded);
              reportProgress();
            },
          });
        } catch (error) {
          inFlight.delete(partNumber);
          reportProgress();
          if (error instanceof BlobUploadAbortedError || signal.aborted) {
            throw new BlobUploadAbortedError();
          }
          if (attempt >= maxAttempts || !isRetryable(error)) throw error;
          refreshUrl = error instanceof BlobUploadError && error.status === 403;
          await sleep(retryBaseDelayMs * 2 ** (attempt - 1), signal);
          continue;
        }

        const etag = result.getHeader('ETag');
        if (!etag) {
          // Only happens when the bucket's CORS rule does not expose ETag.
          throw new BlobUploadError(
            'Storage did not return a part checksum (ETag). The bucket CORS rule must expose the ETag header.',
            result.status,
          );
        }
        etags[partNumber - 1] = etag;
        inFlight.delete(partNumber);
        settled[partNumber - 1] = chunk.size;
        reportProgress();
        return;
      }
    };

    let next = 1;
    let firstError: unknown;
    const worker = async () => {
      while (firstError === undefined) {
        const partNumber = next;
        next += 1;
        if (partNumber > partCount) return;
        try {
          await uploadPart(partNumber);
        } catch (error) {
          if (firstError === undefined) {
            firstError = error;
            internal.abort();
          }
          return;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, partCount) }, () => worker()),
    );
    if (firstError !== undefined) throw firstError;

    throwIfAborted(signal);
    const completed = await api.complete(
      uploadId,
      uploadKey,
      etags.map((etag, index) => ({ partNumber: index + 1, etag })),
      signal,
    );

    options.onProgress?.(file.size);
    return { key: completed?.key || uploadKey };
  } catch (error) {
    await abortUpload();
    if (cancelled()) throw new BlobUploadAbortedError();
    throw error;
  } finally {
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
};
