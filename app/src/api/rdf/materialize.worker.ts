/// <reference lib="webworker" />
import { AppError } from '../errors';
import { materialize } from './materialize';
import { parseTurtle } from './parser';
import type { MaterializeRequest, MaterializeResponse } from './engine';

/** Parses and materializes Turtle off the main thread, so large files never block the UI. */
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data }: MessageEvent<MaterializeRequest>) => {
  let response: MaterializeResponse;
  try {
    response = { id: data.id, model: materialize(await parseTurtle(data.text, data.baseIRI)) };
  } catch (e) {
    const error = e instanceof AppError ? e : new AppError('PARSE_ERROR', (e as Error).message);
    response = { id: data.id, error: { code: error.code, message: error.message } };
  }
  scope.postMessage(response);
};
