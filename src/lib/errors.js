/** Error that carries an HTTP status; thrown by services and turned into a JSON response by `handle`. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
