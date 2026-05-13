export class RegistryError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503 = 400,
    readonly code?: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "RegistryError";
  }
}

export function isRegistryError(error: unknown): error is RegistryError {
  return error instanceof RegistryError;
}
