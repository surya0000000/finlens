import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

type TokenPayload = {
  sub: string;
  email: string;
};

const getTokenFromHeader = (header?: string): string | null => {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

export const requireAuth = (request: Request, _response: Response, next: NextFunction): void => {
  const token = getTokenFromHeader(request.headers.authorization);

  if (!token) {
    next(new HttpError(401, "Missing or invalid Authorization header."));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    if (!decoded?.sub || !decoded?.email) {
      throw new HttpError(401, "Invalid authentication token.");
    }

    request.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }

    next(new HttpError(401, "Authentication failed."));
  }
};

