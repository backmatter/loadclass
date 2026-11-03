export class RegistryError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;
  readonly code: string | undefined;
  readonly detail: string | undefined;

  constructor(
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503 = 400,
    code?: string,
    detail?: string,
  ) {
    super(message);
    this.name = "RegistryError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function isRegistryError(error: unknown): error is RegistryError {
  return error instanceof RegistryError;
}
