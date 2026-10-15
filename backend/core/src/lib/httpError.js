/** An error that maps directly to an HTTP response: { error: code, message }. */
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}
