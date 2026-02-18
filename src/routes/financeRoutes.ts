import { prisma } from "../lib/prisma";
import { Router } from "express";
import { z } from "zod";

import { getDashboardSummary } from "../services/dashboardService";
import { generateInsightsForUser } from "../services/insightService";
import {
  detectUserSubscriptions,
  simulateSubscriptionCancellation,
} from "../services/subscriptionService";
import { HttpError } from "../utils/httpError";
import { round } from "../utils/math";

const financeRoutes = Router();

const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  accountId: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  from: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  to: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
});

const simulationSchema = z.object({
  merchantNames: z.array(z.string().min(1)).min(1),
});

financeRoutes.get("/accounts", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  response.status(200).json({
    accounts: accounts.map((account) => ({
      id: account.id,
      plaidAccountId: account.plaidAccountId,
      plaidItemId: account.plaidItemId,
      name: account.name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
      currentBalance: Number(account.currentBalance),
      availableBalance:
        account.availableBalance === null ? null : Number(account.availableBalance),
      isoCurrencyCode: account.isoCurrencyCode,
      unofficialCurrencyCode: account.unofficialCurrencyCode,
    })),
  });
});

financeRoutes.get("/transactions", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const query = transactionsQuerySchema.parse(request.query);

  const where = {
    userId,
    accountId: query.accountId,
    primaryCategory: query.category,
    date: {
      gte: query.from,
      lte: query.to,
    },
  };

  const [totalCount, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            mask: true,
            type: true,
          },
        },
      },
    }),
  ]);

  response.status(200).json({
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      plaidTransactionId: transaction.plaidTransactionId,
      accountId: transaction.accountId,
      accountName: transaction.account.name,
      accountMask: transaction.account.mask,
      accountType: transaction.account.type,
      amount: Number(transaction.amount),
      date: transaction.date,
      authorizedDate: transaction.authorizedDate,
      pending: transaction.pending,
      paymentChannel: transaction.paymentChannel,
      name: transaction.name,
      merchantName: transaction.merchantName,
      primaryCategory: transaction.primaryCategory,
      detailedCategory: transaction.detailedCategory,
    })),
  });
});

financeRoutes.get("/dashboard", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const dashboard = await getDashboardSummary(userId);
  response.status(200).json(dashboard);
});

financeRoutes.get("/subscriptions", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const subscriptions = await detectUserSubscriptions(userId);
  response.status(200).json({
    subscriptions,
    totals: {
      estimatedMonthlyCost: round(
        subscriptions.reduce((total, subscription) => total + subscription.estimatedMonthlyCost, 0),
      ),
      estimatedYearlyCost: round(
        subscriptions.reduce((total, subscription) => total + subscription.estimatedMonthlyCost, 0) *
          12,
      ),
    },
  });
});

financeRoutes.post("/subscriptions/simulate-cancel", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const payload = simulationSchema.parse(request.body);
  const simulation = await simulateSubscriptionCancellation(userId, payload.merchantNames);
  response.status(200).json(simulation);
});

financeRoutes.get("/insights", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const insights = await generateInsightsForUser(userId);
  response.status(200).json({ insights });
});

export { financeRoutes };

