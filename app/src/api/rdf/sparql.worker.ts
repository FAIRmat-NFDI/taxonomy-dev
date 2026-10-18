/// <reference lib="webworker" />
import init, { Store } from 'oxigraph/web.js';
import wasmUrl from 'oxigraph/web_bg.wasm?url';
import type { SparqlRequest, SparqlResponse } from './sparql';
import { toSparqlResult } from './sparqlResult';

/**
 * SPARQL 1.1 over the loaded Turtle, with Oxigraph (Rust → WebAssembly), off the main thread.
 * The store is built once per file version and reused for every query.
 */
const scope = self as unknown as DedicatedWorkerGlobalScope;
let ready: Promise<unknown> | null = null;
let store: Store | null = null;
let loadedVersion: string | null = null;

scope.onmessage = async ({ data }: MessageEvent<SparqlRequest>) => {
  let response: SparqlResponse;
  try {
    ready ??= init({ module_or_path: wasmUrl });
    await ready;
    if (data.text !== undefined || !store || loadedVersion !== data.version) {
      if (data.text === undefined) throw new Error('NEEDS_TEXT');
      store = new Store();
      store.load(data.text, { format: 'text/turtle', lenient: true });
      loadedVersion = data.version;
    }
    response = { id: data.id, result: toSparqlResult(store.query(data.query)) };
  } catch (e) {
    response = { id: data.id, error: e instanceof Error ? e.message : String(e) };
  }
  scope.postMessage(response);
};
