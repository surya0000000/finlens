import { Router } from "express";

import { prisma } from "../lib/prisma";

const healthRoutes = Router();

healthRoutes.get("/", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "finlens-x-backend",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/ready", async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`;

  response.status(200).json({
    status: "ready",
    service: "finlens-x-backend",
    timestamp: new Date().toISOString(),
  });
});

export { healthRoutes };

