import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { getUserById, loginUser, registerUser } from "../services/authService";

const authRoutes = Router();

const registerSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8).max(128),
});

authRoutes.post("/register", async (request, response) => {
  const payload = registerSchema.parse(request.body);
  const result = await registerUser(payload);
  response.status(201).json(result);
});

authRoutes.post("/login", async (request, response) => {
  const payload = loginSchema.parse(request.body);
  const result = await loginUser(payload);
  response.status(200).json(result);
});

authRoutes.get("/me", requireAuth, async (request, response) => {
  const userId = request.user?.id;

  if (!userId) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const user = await getUserById(userId);
  response.status(200).json({ user });
});

export { authRoutes };

