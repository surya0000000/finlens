import { prisma } from "../lib/prisma";
import { round } from "../utils/math";
import { getDashboardSummary } from "./dashboardService";
import { detectUserSubscriptions } from "./subscriptionService";

type InsightSeverity = "info" | "success" | "warning";

type InsightCard = {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  confidence: number;
  dataReferences: string[];
};

export const generateInsightsForUser = async (userId: string): Promise<InsightCard[]> => {
  const [summary, subscriptions, currentMonthTransactions] = await Promise.all([
    getDashboardSummary(userId),
    detectUserSubscriptions(userId),
    prisma.transaction.findMany({
      where: {
        userId,
        pending: false,
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      select: {
        amount: true,
        merchantName: true,
        name: true,
      },
    }),
  ]);

  const insights: InsightCard[] = [];

  if (summary.cashFlow.spendChangePct !== null && summary.cashFlow.spendChangePct > 12) {
    insights.push({
      id: "spend-trend-up",
      severity: "warning",
      title: "Spending increased month-over-month",
      message: `Your spend is up ${summary.cashFlow.spendChangePct}% vs last month. Reviewing discretionary categories now can prevent end-of-month cash pressure.`,
      confidence: 0.9,
      dataReferences: ["cashFlow.monthSpend", "cashFlow.previousMonthSpend"],
    });
  }

  if (summary.subscriptions.estimatedMonthlyTotal > 100) {
    insights.push({
      id: "subscription-overview",
      severity: "info",
      title: "High recurring subscription cost detected",
      message: `Detected recurring charges total about $${summary.subscriptions.estimatedMonthlyTotal}/month. Pruning low-value subscriptions could save roughly $${round(
        summary.subscriptions.estimatedMonthlyTotal * 12,
      )}/year.`,
      confidence: 0.82,
      dataReferences: ["subscriptions.detectedCount", "subscriptions.estimatedMonthlyTotal"],
    });
  }

  if (summary.credit.utilizationPct !== null && summary.credit.utilizationPct > 30) {
    insights.push({
      id: "credit-utilization",
      severity: "warning",
      title: "Credit utilization above ideal threshold",
      message: `Current utilization is ${summary.credit.utilizationPct}%. Moving below 30% can improve credit profile and reduce interest drag.`,
      confidence: 0.88,
      dataReferences: ["credit.utilizationPct", "credit.revolvingBalance"],
    });
  }

  const merchantSpendMap = new Map<string, number>();
  for (const transaction of currentMonthTransactions) {
    const amount = Number(transaction.amount);
    if (amount <= 0) {
      continue;
    }

    const merchant = transaction.merchantName ?? transaction.name;
    merchantSpendMap.set(merchant, (merchantSpendMap.get(merchant) ?? 0) + amount);
  }

  const topMerchant = [...merchantSpendMap.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topMerchant) {
    insights.push({
      id: "top-merchant-spend",
      severity: "info",
      title: "Top spend merchant this month",
      message: `${topMerchant[0]} is currently your largest spending merchant at $${round(
        topMerchant[1],
      )} this month.`,
      confidence: 0.78,
      dataReferences: ["transactions.currentMonth"],
    });
  }

  if (summary.cashFlow.monthNet > 0) {
    insights.push({
      id: "positive-cashflow",
      severity: "success",
      title: "Positive cash flow this month",
      message: `You are currently net positive by $${summary.cashFlow.monthNet}. Routing a portion to high-yield savings can improve returns without adding risk.`,
      confidence: 0.85,
      dataReferences: ["cashFlow.monthIncome", "cashFlow.monthSpend"],
    });
  }

  const highestSubscription = subscriptions[0];
  if (highestSubscription) {
    insights.push({
      id: "highest-subscription",
      severity: "info",
      title: "Largest recurring payment",
      message: `${highestSubscription.merchant} is your highest recurring charge at about $${highestSubscription.estimatedMonthlyCost}/month.`,
      confidence: highestSubscription.confidence,
      dataReferences: ["subscriptions.merchant", "subscriptions.estimatedMonthlyCost"],
    });
  }

  return insights.slice(0, 6);
};

export type { InsightCard };

