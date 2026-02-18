import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export const notFoundHandler = (_request: Request, response: Response): void => {
  response.status(404).json({
    error: "Route not found.",
  });
};

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Validation error.",
      issues: error.issues,
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  if (env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  response.status(500).json({
    error: "Internal server error.",
  });
};

