/**
 * Minimal XMLHttpRequest stand-in for Node tests. Each send() is handed to
 * `FakeXhr.respond`, which decides the status, headers and body; requests are
 * recorded in `FakeXhr.requests`.
 */
export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodySize: number;
}

export interface FakeResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
  /** Simulate a network failure (onerror, status 0). */
  networkError?: boolean;
  /** Resolve after this many ms instead of on the next microtask. */
  delayMs?: number;
}

type Responder = (request: RecordedRequest) => FakeResponse | Promise<FakeResponse>;

export class FakeXhr {
  static requests: RecordedRequest[] = [];
  static respond: Responder = () => ({ status: 201 });
  static inFlight = 0;
  static maxInFlight = 0;

  static reset(responder: Responder) {
    FakeXhr.requests = [];
    FakeXhr.respond = responder;
    FakeXhr.inFlight = 0;
    FakeXhr.maxInFlight = 0;
  }

  status = 0;
  responseText = '';
  upload: { onprogress: ((event: { loaded: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  private method = '';
  private url = '';
  private headers: Record<string, string> = {};
  private responseHeaders: Record<string, string> = {};
  private done = false;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  getResponseHeader(name: string): string | null {
    const match = Object.keys(this.responseHeaders).find(
      (key) => key.toLowerCase() === name.toLowerCase(),
    );
    return match ? this.responseHeaders[match] : null;
  }

  abort() {
    if (this.done) return;
    this.done = true;
    FakeXhr.inFlight -= 1;
    this.onabort?.();
  }

  send(body: Blob) {
    const request: RecordedRequest = {
      method: this.method,
      url: this.url,
      headers: { ...this.headers },
      bodySize: body?.size ?? 0,
    };
    FakeXhr.requests.push(request);
    FakeXhr.inFlight += 1;
    FakeXhr.maxInFlight = Math.max(FakeXhr.maxInFlight, FakeXhr.inFlight);

    void Promise.resolve(FakeXhr.respond(request)).then(async (response) => {
      if (response.delayMs) await new Promise((r) => setTimeout(r, response.delayMs));
      if (this.done) return;
      this.done = true;
      FakeXhr.inFlight -= 1;
      if (response.networkError) {
        this.onerror?.();
        return;
      }
      this.upload.onprogress?.({ loaded: request.bodySize });
      this.status = response.status;
      this.responseText = response.body ?? '';
      this.responseHeaders = response.headers ?? {};
      this.onload?.();
    });
  }
}
