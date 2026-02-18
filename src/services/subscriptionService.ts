import { prisma } from "../lib/prisma";
import { addDays } from "../utils/date";
import { mean, round, standardDeviation } from "../utils/math";

type DetectedSubscription = {
  merchant: string;
  cadence: "weekly" | "biweekly" | "monthly";
  averageAmount: number;
  estimatedMonthlyCost: number;
  lastChargeDate: Date;
  nextExpectedChargeDate: Date;
  confidence: number;
  chargeCount: number;
};

const normalizeMerchantKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectCadence = (intervals: number[]): {
  cadence: "weekly" | "biweekly" | "monthly";
  intervalDays: number;
} | null => {
  if (!intervals.length) {
    return null;
  }

  const avg = mean(intervals);
  const candidates = [
    { cadence: "weekly" as const, intervalDays: 7, tolerance: 2 },
    { cadence: "biweekly" as const, intervalDays: 14, tolerance: 3 },
    { cadence: "monthly" as const, intervalDays: 30, tolerance: 6 },
  ];

  const winner = candidates.find((candidate) => Math.abs(avg - candidate.intervalDays) <= candidate.tolerance);

  if (!winner) {
    return null;
  }

  return {
    cadence: winner.cadence,
    intervalDays: winner.intervalDays,
  };
};

const toMonthlyCost = (amount: number, cadence: "weekly" | "biweekly" | "monthly"): number => {
  switch (cadence) {
    case "weekly":
      return amount * 4.33;
    case "biweekly":
      return amount * 2.17;
    case "monthly":
      return amount;
    default:
      return amount;
  }
};

export const detectUserSubscriptions = async (userId: string): Promise<DetectedSubscription[]> => {
  const lookbackStart = addDays(new Date(), -180);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      pending: false,
      amount: {
        gt: 0,
      },
      date: {
        gte: lookbackStart,
      },
    },
    select: {
      amount: true,
      date: true,
      merchantName: true,
      name: true,
    },
    orderBy: {
      date: "asc",
    },
  });

  const grouped = new Map<
    string,
    Array<{ amount: number; date: Date; merchantLabel: string }>
  >();

  for (const transaction of transactions) {
    const merchantLabel = (transaction.merchantName ?? transaction.name).trim();

    if (!merchantLabel) {
      continue;
    }

    const key = normalizeMerchantKey(merchantLabel);
    const existing = grouped.get(key) ?? [];
    existing.push({
      amount: Number(transaction.amount),
      date: transaction.date,
      merchantLabel,
    });
    grouped.set(key, existing);
  }

  const subscriptions: DetectedSubscription[] = [];

  for (const [, group] of grouped) {
    if (group.length < 2) {
      continue;
    }

    const intervals: number[] = [];
    for (let index = 1; index < group.length; index += 1) {
      const currentDate = group[index]?.date;
      const previousDate = group[index - 1]?.date;

      if (!currentDate || !previousDate) {
        continue;
      }

      const days = Math.round(
        (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      intervals.push(days);
    }

    const cadenceMatch = detectCadence(intervals);
    if (!cadenceMatch) {
      continue;
    }

    const amounts = group.map((entry) => entry.amount);
    const amountMean = mean(amounts);
    if (amountMean <= 0) {
      continue;
    }

    const amountVolatility = standardDeviation(amounts) / amountMean;
    if (amountVolatility > 0.35) {
      continue;
    }

    const intervalVolatility = intervals.length ? standardDeviation(intervals) / cadenceMatch.intervalDays : 0;
    const confidence = Math.max(
      0,
      Math.min(1, 1 - amountVolatility * 0.55 - intervalVolatility * 0.45),
    );

    const lastChargeDate = group[group.length - 1]?.date ?? new Date();
    const merchant = group[0]?.merchantLabel ?? "Unknown subscription";
    const averageAmount = round(amountMean, 2);
    const estimatedMonthlyCost = round(
      toMonthlyCost(averageAmount, cadenceMatch.cadence),
      2,
    );

    subscriptions.push({
      merchant,
      cadence: cadenceMatch.cadence,
      averageAmount,
      estimatedMonthlyCost,
      lastChargeDate,
      nextExpectedChargeDate: addDays(lastChargeDate, cadenceMatch.intervalDays),
      confidence: round(confidence, 3),
      chargeCount: group.length,
    });
  }

  return subscriptions.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost);
};

export const simulateSubscriptionCancellation = async (
  userId: string,
  merchantNames: string[],
): Promise<{
  merchants: string[];
  monthlySavings: number;
  yearlySavings: number;
}> => {
  const subscriptions = await detectUserSubscriptions(userId);
  const nameSet = new Set(merchantNames.map((name) => normalizeMerchantKey(name)));

  const matched = subscriptions.filter((subscription) =>
    nameSet.has(normalizeMerchantKey(subscription.merchant)),
  );

  const monthlySavings = round(
    matched.reduce((total, subscription) => total + subscription.estimatedMonthlyCost, 0),
    2,
  );

  return {
    merchants: matched.map((entry) => entry.merchant),
    monthlySavings,
    yearlySavings: round(monthlySavings * 12, 2),
  };
};

export type { DetectedSubscription };

