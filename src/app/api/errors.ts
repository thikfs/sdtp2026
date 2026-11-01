/** A non-2xx answer from the backend. 404 = gone, 409 = someone else changed it first. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
