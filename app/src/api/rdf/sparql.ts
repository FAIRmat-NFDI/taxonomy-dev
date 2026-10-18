import { AppError } from '../errors';
import type { SparqlResult } from './sparqlResult';

export interface SparqlRequest {
  id: number;
  /** Identifies the file version (e.g. branch@commit); the worker keeps one store per version. */
  version: string;
  /** Sent only when the worker does not have this version yet. */
  text?: string;
  query: string;
}
export type SparqlResponse = { id: number; result: SparqlResult } | { id: number; error: string };

let worker: Worker | null = null;
let workerVersion: string | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (r: SparqlResult) => void; reject: (e: AppError) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./sparql.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<SparqlResponse>) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if ('error' in data) request.reject(new AppError('PARSE_ERROR', data.error));
    else request.resolve(data.result);
  };
  worker.onerror = (event) => {
    const error = new AppError('UNKNOWN', `SPARQL engine failed: ${event.message}`);
    pending.forEach((p) => p.reject(error));
    pending.clear();
    worker?.terminate();
    worker = null;
    workerVersion = null;
  };
  return worker;
}

/**
 * Runs a SPARQL 1.1 query (SELECT / ASK / CONSTRUCT / DESCRIBE) over the ontology text in a Web Worker
 * (Oxigraph, WebAssembly — loaded on first use). Rejects with the engine's message on syntax errors.
 */
export function runSparql(text: string, version: string, query: string): Promise<SparqlResult> {
  if (typeof Worker === 'undefined') return Promise.reject(new AppError('NOT_IMPLEMENTED', 'SPARQL needs a browser with Web Workers.'));
  const w = getWorker();
  const id = nextId++;
  const sendText = workerVersion !== version;
  workerVersion = version;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, version, query, ...(sendText ? { text } : {}) } satisfies SparqlRequest);
  });
}
