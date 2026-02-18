import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";

type RegisterInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

export const signAuthToken = (payload: { id: string; email: string }): string =>
  jwt.sign({ sub: payload.id, email: payload.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

export const toPublicUser = (user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}): {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
} => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  createdAt: user.createdAt,
});

export const registerUser = async (input: RegisterInput): Promise<{
  token: string;
  user: ReturnType<typeof toPublicUser>;
}> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  const token = signAuthToken({ id: user.id, email: user.email });
  return { token, user: toPublicUser(user) };
};

export const loginUser = async (input: LoginInput): Promise<{
  token: string;
  user: ReturnType<typeof toPublicUser>;
}> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!validPassword) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const token = signAuthToken({ id: user.id, email: user.email });
  return { token, user: toPublicUser(user) };
};

export const getUserById = async (userId: string): Promise<ReturnType<typeof toPublicUser>> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  return user;
};

