import { Router } from "express";
import { z } from "zod";

import {
  createPlaidLinkToken,
  createSandboxPublicToken,
  exchangePlaidPublicToken,
  listPlaidItemsForUser,
} from "../services/plaidService";
import {
  syncAllPlaidItemsForUser,
  syncSinglePlaidItem,
} from "../services/transactionSyncService";
import { HttpError } from "../utils/httpError";

const plaidRoutes = Router();

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().min(1).optional(),
});

const syncSchema = z.object({
  itemId: z.string().min(1).optional(),
});

const sandboxSchema = z.object({
  institutionId: z.string().min(1).optional(),
});

plaidRoutes.post("/link-token", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const result = await createPlaidLinkToken(userId);
  response.status(200).json(result);
});

plaidRoutes.post("/exchange-public-token", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const payload = exchangeSchema.parse(request.body);
  const result = await exchangePlaidPublicToken({
    userId,
    publicToken: payload.publicToken,
    institutionName: payload.institutionName,
  });

  response.status(201).json(result);
});

plaidRoutes.get("/items", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const items = await listPlaidItemsForUser(userId);
  response.status(200).json({ items });
});

plaidRoutes.post("/sync", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const payload = syncSchema.parse(request.body ?? {});
  if (payload.itemId) {
    const stats = await syncSinglePlaidItem(userId, payload.itemId);
    response.status(200).json({
      syncedItems: 1,
      totalAdded: stats.added,
      totalModified: stats.modified,
      totalRemoved: stats.removed,
    });
    return;
  }

  const summary = await syncAllPlaidItemsForUser(userId);
  response.status(200).json(summary);
});

plaidRoutes.post("/sandbox/public-token", async (request, response) => {
  const payload = sandboxSchema.parse(request.body ?? {});
  const publicToken = await createSandboxPublicToken(payload.institutionId);
  response.status(200).json({ publicToken });
});

export { plaidRoutes };

