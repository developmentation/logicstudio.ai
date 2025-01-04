class ApiError extends Error {
  constructor(status, message, isOperational = true, stack = '') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(msg) {
    return new ApiError(400, msg);
  }

  static unauthorized(msg) {
    return new ApiError(401, msg);
  }

  static forbidden(msg) {
    return new ApiError(403, msg);
  }

  static notFound(msg) {
    return new ApiError(404, msg);
  }

  static conflict(msg) {
    return new ApiError(409, msg);
  }

  static unprocessableEntity(msg) {
    return new ApiError(422, msg);
  }

  static internal(msg) {
    return new ApiError(500, msg);
  }
}

module.exports = ApiError;