import { prisma } from "../lib/prisma";
import {
  endOfPreviousMonth,
  startOfMonth,
  startOfPreviousMonth,
} from "../utils/date";
import { round } from "../utils/math";
import { detectUserSubscriptions } from "./subscriptionService";
import { calculateForecastBurnRate } from "./transactionSyncService";

type CategoryBreakdown = {
  category: string;
  amount: number;
  transactionCount: number;
};

type DashboardSummary = {
  totals: {
    assets: number;
    liabilities: number;
    netWorth: number;
    cash: number;
    investments: number;
    debt: number;
  };
  cashFlow: {
    monthIncome: number;
    monthSpend: number;
    monthNet: number;
    previousMonthSpend: number;
    spendChangePct: number | null;
    avgDailyOutflow: number;
    projected30dOutflow: number;
  };
  subscriptions: {
    detectedCount: number;
    estimatedMonthlyTotal: number;
  };
  credit: {
    utilizationPct: number | null;
    revolvingBalance: number;
  };
  topSpendingCategories: CategoryBreakdown[];
  accountsCount: number;
};

const getAccountTotals = (accounts: Array<{
  type: string;
  currentBalance: number;
}>): DashboardSummary["totals"] => {
  let assets = 0;
  let liabilities = 0;
  let cash = 0;
  let investments = 0;

  for (const account of accounts) {
    const balance = Number(account.currentBalance);
    const accountType = account.type.toLowerCase();

    if (accountType === "credit" || accountType === "loan") {
      liabilities += Math.max(balance, 0);
      continue;
    }

    if (balance >= 0) {
      assets += balance;
    } else {
      liabilities += Math.abs(balance);
    }

    if (accountType === "depository") {
      cash += Math.max(balance, 0);
    }

    if (accountType === "investment") {
      investments += Math.max(balance, 0);
    }
  }

  return {
    assets: round(assets),
    liabilities: round(liabilities),
    netWorth: round(assets - liabilities),
    cash: round(cash),
    investments: round(investments),
    debt: round(liabilities),
  };
};

const getCreditUtilization = (
  creditAccounts: Array<{ currentBalance: number; availableBalance: number | null }>,
): { utilizationPct: number | null; revolvingBalance: number } => {
  if (!creditAccounts.length) {
    return {
      utilizationPct: null,
      revolvingBalance: 0,
    };
  }

  let totalBalance = 0;
  let totalLimit = 0;

  for (const account of creditAccounts) {
    const balance = Math.max(Number(account.currentBalance), 0);
    totalBalance += balance;

    if (account.availableBalance !== null) {
      totalLimit += balance + Number(account.availableBalance);
    }
  }

  return {
    utilizationPct: totalLimit > 0 ? round((totalBalance / totalLimit) * 100, 2) : null,
    revolvingBalance: round(totalBalance),
  };
};

export const getDashboardSummary = async (userId: string): Promise<DashboardSummary> => {
  const [accounts, transactions, subscriptions] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        currentBalance: true,
        availableBalance: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        pending: false,
        date: {
          gte: startOfPreviousMonth(),
        },
      },
      select: {
        amount: true,
        date: true,
        primaryCategory: true,
      },
    }),
    detectUserSubscriptions(userId),
  ]);

  const totals = getAccountTotals(
    accounts.map((account) => ({
      type: account.type,
      currentBalance: Number(account.currentBalance),
    })),
  );

  const monthStart = startOfMonth();
  const prevMonthStart = startOfPreviousMonth();
  const prevMonthEnd = endOfPreviousMonth();

  const currentMonth = transactions.filter((entry) => entry.date >= monthStart);
  const previousMonth = transactions.filter(
    (entry) => entry.date >= prevMonthStart && entry.date <= prevMonthEnd,
  );

  const monthSpend = currentMonth
    .filter((entry) => Number(entry.amount) > 0)
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const monthIncome = currentMonth
    .filter((entry) => Number(entry.amount) < 0)
    .reduce((total, entry) => total + Math.abs(Number(entry.amount)), 0);

  const previousMonthSpend = previousMonth
    .filter((entry) => Number(entry.amount) > 0)
    .reduce((total, entry) => total + Number(entry.amount), 0);

  const spendChangePct =
    previousMonthSpend > 0
      ? round(((monthSpend - previousMonthSpend) / previousMonthSpend) * 100, 2)
      : null;

  const categoryMap = new Map<string, { amount: number; transactionCount: number }>();
  for (const transaction of currentMonth) {
    const amount = Number(transaction.amount);
    if (amount <= 0) {
      continue;
    }

    const category = transaction.primaryCategory ?? "OTHER";
    const existing = categoryMap.get(category) ?? { amount: 0, transactionCount: 0 };
    existing.amount += amount;
    existing.transactionCount += 1;
    categoryMap.set(category, existing);
  }

  const topSpendingCategories: CategoryBreakdown[] = [...categoryMap.entries()]
    .map(([category, values]) => ({
      category,
      amount: round(values.amount),
      transactionCount: values.transactionCount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const creditUtilization = getCreditUtilization(
    accounts
      .filter((account) => account.type.toLowerCase() === "credit")
      .map((account) => ({
        currentBalance: Number(account.currentBalance),
        availableBalance:
          account.availableBalance === null ? null : Number(account.availableBalance),
      })),
  );

  const forecast = calculateForecastBurnRate(
    currentMonth.map((transaction) => ({
      amount: Number(transaction.amount),
      date: transaction.date,
    })),
  );

  return {
    totals,
    cashFlow: {
      monthIncome: round(monthIncome),
      monthSpend: round(monthSpend),
      monthNet: round(monthIncome - monthSpend),
      previousMonthSpend: round(previousMonthSpend),
      spendChangePct,
      avgDailyOutflow: round(forecast.avgDailyOutflow),
      projected30dOutflow: round(forecast.projected30dOutflow),
    },
    subscriptions: {
      detectedCount: subscriptions.length,
      estimatedMonthlyTotal: round(
        subscriptions.reduce((total, subscription) => total + subscription.estimatedMonthlyCost, 0),
      ),
    },
    credit: creditUtilization,
    topSpendingCategories,
    accountsCount: accounts.length,
  };
};

export type { DashboardSummary };

