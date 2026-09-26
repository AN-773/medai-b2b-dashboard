import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeXhr } from '@/utils/__tests__/fakeXhr';

const apiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('@/services/apiClient', () => ({ apiClient }));
vi.mock('../apiClient', () => ({ apiClient }));

import { courseResourceService } from '../courseResourceService';

const MiB = 1024 * 1024;
const COURSE_ID = 'https://tests.example/courses/cardio-101';
const BASE = '/courses/cardio-101/resources';

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  apiClient.post.mockReset();
  apiClient.delete.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('courseResourceService.uploadTeacherCourseResource', () => {
  it('old server (no provider): Azure PUT with today\'s headers, commit with the minted path', async () => {
    FakeXhr.reset(() => ({ status: 201 }));
    apiClient.post.mockImplementation(async (_svc: string, path: string) => {
      if (path.endsWith('/upload-url')) {
        return { uploadUrl: 'https://acct.blob.core.windows.net/c/course-resources/a.pdf?sig=x', uploadPath: 'course-resources/a.pdf', expiresAt: '' };
      }
      if (path.endsWith('/commit')) return { resources: [{ id: 'r1' }] };
      throw new Error(`unexpected ${path}`);
    });
    const percents: number[] = [];

    const resources = await courseResourceService.uploadTeacherCourseResource(
      COURSE_ID,
      new File([new Uint8Array(4096)], 'a.pdf', { type: 'application/pdf' }),
      { onProgress: (p) => percents.push(p) },
    );

    expect(resources).toEqual([{ id: 'r1' }]);
    expect(FakeXhr.requests).toHaveLength(1);
    expect(FakeXhr.requests[0].headers).toEqual({ 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/pdf' });
    expect(apiClient.post.mock.calls.map((c) => c[1])).toEqual([`${BASE}/upload-url`, `${BASE}/commit`]);
    expect(apiClient.post.mock.calls[1][2]).toMatchObject({ uploadPath: 'course-resources/a.pdf' });
    expect(percents.at(-1)).toBe(100);
  });

  it('s3 + large file: multipart endpoints on the Tests service, then commit', async () => {
    FakeXhr.reset((request) => ({ status: 200, headers: { ETag: `"${new URL(request.url).searchParams.get('partNumber')}"` } }));
    const size = 65 * MiB; // just over the single-PUT limit -> 5 parts of 16 MiB
    apiClient.post.mockImplementation(async (_svc: string, path: string, body: any) => {
      if (path.endsWith('/upload-url')) {
        return {
          uploadUrl: 'https://b.s3.amazonaws.com/course-resources/v.mp4?X-Amz-Signature=s',
          uploadPath: 'course-resources/v.mp4',
          expiresAt: '',
          provider: 's3',
          uploadHeaders: { 'Content-Type': 'video/mp4' },
        };
      }
      if (path === `${BASE}/uploads/multipart`) {
        return { uploadId: 'up/1', key: body.key, partSize: 16 * MiB, partCount: 5 };
      }
      if (path === `${BASE}/uploads/multipart/up%2F1/parts`) {
        return { parts: body.partNumbers.map((n: number) => ({ partNumber: n, url: `https://b.s3.amazonaws.com/k?partNumber=${n}` })) };
      }
      if (path === `${BASE}/uploads/multipart/up%2F1/complete`) return { key: body.key };
      if (path.endsWith('/commit')) return { resources: [{ id: 'r2' }] };
      throw new Error(`unexpected ${path}`);
    });

    const resources = await courseResourceService.uploadTeacherCourseResource(
      COURSE_ID,
      new File([new Uint8Array(size)], 'v.mp4', { type: 'video/mp4' }),
    );

    expect(resources).toEqual([{ id: 'r2' }]);
    const createCall = apiClient.post.mock.calls.find((c) => c[1] === `${BASE}/uploads/multipart`);
    expect(createCall?.[2]).toEqual({ key: 'course-resources/v.mp4', contentType: 'video/mp4', size });
    const completeCall = apiClient.post.mock.calls.find((c) => String(c[1]).endsWith('/complete'));
    expect(completeCall?.[2].parts).toEqual([1, 2, 3, 4, 5].map((n) => ({ partNumber: n, etag: `"${n}"` })));
    const commitCall = apiClient.post.mock.calls.find((c) => String(c[1]).endsWith('/commit'));
    expect(commitCall?.[2]).toMatchObject({ uploadPath: 'course-resources/v.mp4' });
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('s3 multipart failure calls the abort endpoint and skips commit', async () => {
    FakeXhr.reset(() => ({ status: 400 }));
    apiClient.post.mockImplementation(async (_svc: string, path: string, body: any) => {
      if (path.endsWith('/upload-url')) {
        return { uploadUrl: 'https://u', uploadPath: 'course-resources/v.mp4', expiresAt: '', provider: 's3', uploadHeaders: {} };
      }
      if (path === `${BASE}/uploads/multipart`) {
        return { uploadId: 'u9', key: body.key, partSize: 16 * MiB, partCount: 5 };
      }
      if (path.endsWith('/parts')) {
        return { parts: body.partNumbers.map((n: number) => ({ partNumber: n, url: `https://b/k?partNumber=${n}` })) };
      }
      throw new Error(`unexpected ${path}`);
    });
    apiClient.delete.mockResolvedValue(undefined);

    await expect(
      courseResourceService.uploadTeacherCourseResource(
        COURSE_ID,
        new File([new Uint8Array(65 * MiB)], 'v.mp4', { type: 'video/mp4' }),
      ),
    ).rejects.toThrow();

    expect(apiClient.delete).toHaveBeenCalledWith(
      'TESTS',
      `${BASE}/uploads/multipart/u9?key=${encodeURIComponent('course-resources/v.mp4')}`,
    );
    expect(apiClient.post.mock.calls.some((c) => String(c[1]).endsWith('/commit'))).toBe(false);
  });
});
