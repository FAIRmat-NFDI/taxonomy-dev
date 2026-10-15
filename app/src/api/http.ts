import { AppError, type AppErrorCode } from './errors';

/** Where a request goes and how it authenticates. */
export interface ApiTarget {
  /** Absolute ("https://api.github.com") or same-origin relative ("/api"). */
  baseUrl: string;
  /** Sent as `Authorization: Bearer <token>`. */
  token?: string | null;
  headers?: Record<string, string>;
}

export type Query = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

function codeFor(status: number, rateLimited: boolean): AppErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return rateLimited ? 'RATE_LIMITED' : 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 501) return 'NOT_IMPLEMENTED';
  return 'UNKNOWN';
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * The one HTTP function the app uses — plain fetch + JSON, no SDKs.
 * GitHub, the backend and the backend's GitHub proxy are all just targets.
 */
export async function request<T>(target: ApiTarget, method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${target.baseUrl}${path}`, globalThis.location?.origin ?? 'http://localhost');
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: 'application/json', ...target.headers };
  if (target.token) headers.Authorization = `Bearer ${target.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (e) {
    throw new AppError('NETWORK', `Could not reach ${url.host}.`, e);
  }

  const text = await res.text();
  const data = text ? parse(text) : undefined;
  if (!res.ok) {
    const message = (data as { message?: string } | undefined)?.message ?? `${method} ${path} failed (${res.status}).`;
    throw new AppError(codeFor(res.status, res.headers.get('x-ratelimit-remaining') === '0'), message, data);
  }
  return data as T;
}
