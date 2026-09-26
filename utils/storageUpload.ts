/**
 * Picks the upload protocol from the server's "get me an upload URL" response
 * (STORAGE-S3-CONTRACT.md §5):
 *
 * | provider           | file ≤ 64 MiB                     | file > 64 MiB                  |
 * |--------------------|-----------------------------------|--------------------------------|
 * | missing / "azure"  | one PUT to the SAS URL            | Azure Put Block / Block List   |
 * | "s3"               | one PUT to the presigned URL      | S3 multipart via test-service  |
 *
 * A single PUT always sends exactly `uploadHeaders` when the server returned
 * them. A response without `provider` comes from a server that predates the
 * S3 work, and is handled exactly as before (today's Azure headers).
 */
import {
  BlobUploadError,
  SINGLE_SHOT_LIMIT,
  uploadFileToBlobUrl,
  uploadSingleShot,
} from './blockBlobUpload';
import { uploadS3Multipart, type S3MultipartApi } from './s3MultipartUpload';

export type StorageProvider = 'azure' | 's3';

/**
 * Sent on every "get an upload URL" request and on multipart create
 * (STORAGE-S3-CONTRACT.md §6a). Servers only hand out S3 URLs to clients that
 * advertise `s3` here; everyone else keeps getting Azure.
 */
export const UPLOAD_PROVIDERS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Upload-Providers': 'azure,s3',
});

export interface SignedUploadTarget {
  uploadUrl: string;
  /** Storage key the server minted; returned unchanged unless S3 multipart assigns another. */
  uploadPath: string;
  provider?: StorageProvider | string | null;
  uploadHeaders?: Record<string, string> | null;
}

export interface StorageUploadOptions {
  /** Called with the number of bytes confirmed sent so far. */
  onProgress?: (uploadedBytes: number) => void;
  signal?: AbortSignal;
  /** Required for S3 files over the single-PUT limit. */
  multipartApi?: S3MultipartApi;
}

export type UploadProtocol = 'azure-single' | 'azure-blocks' | 's3-single' | 's3-multipart';

export const resolveProvider = (provider: SignedUploadTarget['provider']): StorageProvider => {
  if (provider === undefined || provider === null || provider === '' || provider === 'azure') {
    return 'azure';
  }
  if (provider === 's3') return 's3';
  throw new BlobUploadError('The server asked for an unsupported storage provider.', 0);
};

export const selectUploadProtocol = (
  provider: SignedUploadTarget['provider'],
  fileSize: number,
): UploadProtocol => {
  const resolved = resolveProvider(provider);
  const large = fileSize > SINGLE_SHOT_LIMIT;
  if (resolved === 's3') return large ? 's3-multipart' : 's3-single';
  return large ? 'azure-blocks' : 'azure-single';
};

const hasHeaders = (headers: SignedUploadTarget['uploadHeaders']): headers is Record<string, string> =>
  Boolean(headers) && typeof headers === 'object' && Object.keys(headers as object).length > 0;

/**
 * Uploads `file` to wherever `target` points. Resolves with the storage key
 * to commit; rejects with BlobUploadAbortedError if the caller cancels.
 */
export const uploadToSignedTarget = async (
  target: SignedUploadTarget,
  file: File,
  options: StorageUploadOptions = {},
): Promise<{ key: string }> => {
  const contentType = file.type || 'application/octet-stream';
  const protocol = selectUploadProtocol(target.provider, file.size);
  const uploadHeaders = hasHeaders(target.uploadHeaders) ? { ...target.uploadHeaders } : undefined;

  switch (protocol) {
    case 'azure-single':
    case 'azure-blocks':
      // Unchanged Azure path; uploadHeaders only replaces the single-PUT headers.
      await uploadFileToBlobUrl(target.uploadUrl, file, {
        onProgress: options.onProgress,
        signal: options.signal,
        singleShotHeaders: uploadHeaders,
      });
      return { key: target.uploadPath };

    case 's3-single':
      await uploadSingleShot(target.uploadUrl, file, contentType, {
        onProgress: options.onProgress,
        signal: options.signal,
        // The presign may sign Content-Type, so it has to match. A server
        // that says "s3" always sends uploadHeaders; this is only a guard.
        singleShotHeaders: uploadHeaders ?? { 'Content-Type': contentType },
      });
      return { key: target.uploadPath };

    case 's3-multipart': {
      if (!options.multipartApi) {
        throw new BlobUploadError('Large uploads to this storage are not supported here.', 0);
      }
      return uploadS3Multipart(options.multipartApi, target.uploadPath, file, contentType, {
        onProgress: options.onProgress,
        signal: options.signal,
      });
    }
  }
};
