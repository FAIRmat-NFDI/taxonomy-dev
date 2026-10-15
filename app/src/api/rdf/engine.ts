import { AppError, type AppErrorCode } from '../errors';
import type { OntologyModel } from '../types';
import { materialize } from './materialize';
import { parseTurtle } from './parser';

export interface MaterializeRequest {
  id: number;
  text: string;
  baseIRI?: string;
}
export type MaterializeResponse = { id: number; model: OntologyModel } | { id: number; error: { code: AppErrorCode; message: string } };

/**
 * Turtle text → OntologyModel.
 *
 * Runs in a dedicated Web Worker (one, reused) when the platform has workers, and on the
 * calling thread otherwise (tests, SSR). The engine is a seam: a WASM parser/store such as
 * Oxigraph can replace the worker body later without touching callers.
 */
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (m: OntologyModel) => void; reject: (e: AppError) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./materialize.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<MaterializeResponse>) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if ('error' in data) request.reject(new AppError(data.error.code, data.error.message));
    else request.resolve(data.model);
  };
  worker.onerror = (event) => {
    const error = new AppError('UNKNOWN', `Ontology worker failed: ${event.message}`);
    pending.forEach((p) => p.reject(error));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export async function materializeTurtle(text: string, baseIRI?: string): Promise<OntologyModel> {
  if (typeof Worker === 'undefined') return materialize(await parseTurtle(text, baseIRI));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text, baseIRI } satisfies MaterializeRequest);
  });
}
