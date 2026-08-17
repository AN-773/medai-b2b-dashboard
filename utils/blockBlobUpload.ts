/**
 * Uploads a file straight to Azure Blob Storage using a URL the backend signed
 * for us, so the bytes never pass through the Tests service.
 *
 * A single PUT to a blob is capped at 256 MiB by Azure, and a lecture video is
 * routinely larger, so anything past SINGLE_SHOT_LIMIT is staged as blocks
 * (Put Block) and then assembled (Put Block List). Written against the REST API
 * directly rather than @azure/storage-blob: the two calls involved are small,
 * and XMLHttpRequest gives byte-level upload progress that fetch cannot.
 */

/** Files at or below this go up in one request. Azure's own ceiling is 256 MiB. */
const SINGLE_SHOT_LIMIT = 64 * 1024 * 1024;

const DEFAULT_BLOCK_SIZE = 8 * 1024 * 1024;

/** Azure will not assemble more blocks than this into one blob. */
const MAX_BLOCKS = 50_000;

/** How many blocks are in flight at once. */
const DEFAULT_CONCURRENCY = 4;

export interface BlockBlobUploadOptions {
  /** Called with the number of bytes confirmed sent so far. */
  onProgress?: (uploadedBytes: number) => void;
  signal?: AbortSignal;
}

export class BlobUploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BlobUploadError';
    this.status = status;
  }
}

/** Thrown when the caller aborts, so callers can tell cancel from failure. */
export class BlobUploadAbortedError extends Error {
  constructor() {
    super('Upload canceled');
    this.name = 'BlobUploadAbortedError';
  }
}

/**
 * Appends query parameters as raw text. Parsing the URL and re-serialising it
 * through URLSearchParams would re-encode the SAS token, and the signature is
 * computed over the exact bytes the server produced — so the existing query is
 * left untouched.
 */
const withQuery = (uploadUrl: string, params: Record<string, string>) => {
  const extra = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${uploadUrl}${uploadUrl.includes('?') ? '&' : '?'}${extra}`;
};

/**
 * Azure returns errors as XML. Surface the human-readable part when there is
 * one — an expired signature otherwise shows up as a bare 403.
 */
const describeFailure = (status: number, body: string): string => {
  const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
  if (code === 'AuthenticationFailed' || status === 403) {
    return 'The upload link expired or was rejected. Try uploading again.';
  }
  if (code) {
    const message = body.match(/<Message>([^<\n]+)/)?.[1];
    return message ? `${code}: ${message}` : code;
  }
  return `Storage rejected the upload (HTTP ${status}).`;
};

/**
 * Block IDs must all be the same length once base64-encoded, and Azure orders
 * the blob by the list we submit rather than by ID, but keeping them ordered
 * makes a partial upload readable in the portal.
 */
const blockId = (index: number) => btoa(`block-${String(index).padStart(6, '0')}`);

interface PutRequest {
  url: string;
  body: Blob;
  headers: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (loadedBytes: number) => void;
}

const put = ({ url, body, headers, signal, onProgress }: PutRequest): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new BlobUploadAbortedError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));

    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort);
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    if (onProgress) {
      xhr.upload.onprogress = (event) => onProgress(event.loaded);
    }
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new BlobUploadError(describeFailure(xhr.status, xhr.responseText || ''), xhr.status));
    };
    xhr.onerror = () => {
      cleanup();
      // A cross-origin PUT that never reaches Azure lands here with no status,
      // which in practice means the storage account is missing a CORS rule.
      reject(
        new BlobUploadError(
          'Could not reach storage. If this keeps happening, the storage account may not allow uploads from this site.',
          0,
        ),
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(new BlobUploadAbortedError());
    };

    xhr.send(body);
  });

const uploadSingleShot = async (
  uploadUrl: string,
  file: File,
  contentType: string,
  options: BlockBlobUploadOptions,
) => {
  await put({
    url: uploadUrl,
    body: file,
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType,
    },
    signal: options.signal,
    onProgress: options.onProgress ? (loaded) => options.onProgress?.(loaded) : undefined,
  });
  options.onProgress?.(file.size);
};

const uploadInBlocks = async (
  uploadUrl: string,
  file: File,
  contentType: string,
  options: BlockBlobUploadOptions,
) => {
  const blockSize = Math.max(DEFAULT_BLOCK_SIZE, Math.ceil(file.size / MAX_BLOCKS));
  const blockCount = Math.ceil(file.size / blockSize);

  // Progress is the sum of finished blocks plus whatever the in-flight ones
  // have pushed, so the bar keeps moving inside a single large block.
  const settled = new Array<number>(blockCount).fill(0);
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

  const ids = Array.from({ length: blockCount }, (_, index) => blockId(index));
  let next = 0;

  const worker = async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= blockCount) return;

      const start = index * blockSize;
      const end = Math.min(start + blockSize, file.size);
      const chunk = file.slice(start, end);

      await put({
        url: withQuery(uploadUrl, { comp: 'block', blockid: ids[index] }),
        body: chunk,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: options.signal,
        onProgress: (loaded) => {
          inFlight.set(index, loaded);
          reportProgress();
        },
      });

      inFlight.delete(index);
      settled[index] = chunk.size;
      reportProgress();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(DEFAULT_CONCURRENCY, blockCount) }, () => worker()),
  );

  const blockList = `<?xml version="1.0" encoding="utf-8"?><BlockList>${ids
    .map((id) => `<Latest>${id}</Latest>`)
    .join('')}</BlockList>`;

  await put({
    url: withQuery(uploadUrl, { comp: 'blocklist' }),
    body: new Blob([blockList], { type: 'application/xml' }),
    headers: {
      'Content-Type': 'application/xml',
      'x-ms-blob-content-type': contentType,
    },
    signal: options.signal,
  });

  options.onProgress?.(file.size);
};

/**
 * Pushes `file` to `uploadUrl`. Resolves once the blob is fully committed;
 * rejects with BlobUploadAbortedError if the caller cancels.
 */
export const uploadFileToBlobUrl = async (
  uploadUrl: string,
  file: File,
  options: BlockBlobUploadOptions = {},
): Promise<void> => {
  const contentType = file.type || 'application/octet-stream';
  if (file.size <= SINGLE_SHOT_LIMIT) {
    await uploadSingleShot(uploadUrl, file, contentType, options);
    return;
  }
  await uploadInBlocks(uploadUrl, file, contentType, options);
};
