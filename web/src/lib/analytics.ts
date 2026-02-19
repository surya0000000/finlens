import dayjs from "dayjs";

import type { Account, Transaction } from "../types/api";

type MonthlyFlow = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

const monthKey = (date: Date): string => dayjs(date).format("YYYY-MM");

const monthLabel = (key: string): string => dayjs(`${key}-01`).format("MMM");

const makeMonthRange = (months: number): string[] => {
  const list: string[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    list.push(dayjs().subtract(index, "month").format("YYYY-MM"));
  }
  return list;
};

export const buildMonthlyFlow = (transactions: Transaction[], months = 12): MonthlyFlow[] => {
  const keys = makeMonthRange(months);
  const map = new Map<string, MonthlyFlow>(
    keys.map((key) => [
      key,
      {
        key,
        label: monthLabel(key),
        income: 0,
        expense: 0,
        net: 0,
      },
    ]),
  );

  for (const transaction of transactions) {
    const key = monthKey(new Date(transaction.date));
    const bucket = map.get(key);
    if (!bucket) {
      continue;
    }

    if (transaction.amount < 0) {
      bucket.income += Math.abs(transaction.amount);
    } else {
      bucket.expense += transaction.amount;
    }

    bucket.net = bucket.income - bucket.expense;
  }

  return keys.map((key) => map.get(key)).filter((entry): entry is MonthlyFlow => Boolean(entry));
};

export const buildNetWorthTrend = (
  monthlyFlow: MonthlyFlow[],
  currentNetWorth: number,
): Array<{ label: string; netWorth: number }> => {
  if (monthlyFlow.length === 0) {
    return [{ label: dayjs().format("MMM"), netWorth: currentNetWorth }];
  }

  const results: number[] = Array.from({ length: monthlyFlow.length }, () => currentNetWorth);
  let running = currentNetWorth;

  for (let index = monthlyFlow.length - 1; index >= 0; index -= 1) {
    results[index] = running;
    running -= monthlyFlow[index]?.net ?? 0;
  }

  return monthlyFlow.map((entry, index) => ({
    label: entry.label,
    netWorth: results[index] ?? currentNetWorth,
  }));
};

export const buildAssetAllocation = (
  accounts: Account[],
): Array<{ segment: string; value: number; color: string }> => {
  let bank = 0;
  let investments = 0;
  let retirement = 0;
  let cashLike = 0;

  for (const account of accounts) {
    const balance = Math.max(account.currentBalance, 0);
    if (balance <= 0) {
      continue;
    }

    const type = account.type.toLowerCase();
    const subtype = account.subtype?.toLowerCase() ?? "";
    const name = account.name.toLowerCase();

    if (type === "depository") {
      bank += balance;
      cashLike += balance;
      continue;
    }

    if (
      type === "investment" &&
      (subtype.includes("ira") ||
        subtype.includes("401") ||
        subtype.includes("retirement") ||
        name.includes("retirement"))
    ) {
      retirement += balance;
      continue;
    }

    if (type === "investment") {
      investments += balance;
      continue;
    }

    if (type !== "credit" && type !== "loan") {
      cashLike += balance;
    }
  }

  const rows = [
    { segment: "Banking", value: bank, color: "#93c5fd" },
    { segment: "Investments", value: investments, color: "#34d399" },
    { segment: "Retirement", value: retirement, color: "#2dd4bf" },
    { segment: "Cash Equivalents", value: cashLike - bank, color: "#c4b5fd" },
  ].filter((entry) => entry.value > 0);

  return rows.length > 0 ? rows : [{ segment: "No Data", value: 1, color: "#cbd5e1" }];
};

export const buildCategoryTrend = (
  transactions: Transaction[],
  months = 6,
  topCategories = 3,
): Array<{ label: string; [key: string]: string | number }> => {
  const keys = makeMonthRange(months);
  const categoryTotals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.amount <= 0) {
      continue;
    }
    const category = transaction.primaryCategory ?? "OTHER";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + transaction.amount);
  }

  const top = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topCategories)
    .map(([name]) => name);

  const trendRows = keys.map((key) => {
    const row: { label: string; [key: string]: string | number } = {
      label: monthLabel(key),
    };

    for (const category of top) {
      row[category] = 0;
    }

    return row;
  });

  const rowMap = new Map(keys.map((key, index) => [key, trendRows[index]]));

  for (const transaction of transactions) {
    if (transaction.amount <= 0) {
      continue;
    }

    const key = monthKey(new Date(transaction.date));
    const row = rowMap.get(key);
    if (!row) {
      continue;
    }

    const category = transaction.primaryCategory ?? "OTHER";
    if (!(category in row)) {
      continue;
    }

    row[category] = Number(row[category] ?? 0) + transaction.amount;
  }

  return trendRows;
};

export const buildInvestmentVsBenchmark = (
  monthlyFlow: MonthlyFlow[],
  currentInvestmentValue: number,
): Array<{ label: string; investment: number; benchmark: number }> => {
  if (monthlyFlow.length === 0) {
    return [{ label: dayjs().format("MMM"), investment: currentInvestmentValue, benchmark: currentInvestmentValue }];
  }

  const months = monthlyFlow.length;
  const monthlyGrowth = 0.006;
  const baseline = currentInvestmentValue / (1 + monthlyGrowth * months * 0.75);
  const rows: Array<{ label: string; investment: number; benchmark: number }> = [];
  let investment = Math.max(baseline, 0);
  let benchmark = Math.max(baseline, 0);

  for (const [index, month] of monthlyFlow.entries()) {
    const modeledContribution = Math.max(month.net * 0.18, 0);
    const volatilityBias = Math.sin((index + 1) * 0.75) * 0.004;
    investment = Math.max(investment * (1 + monthlyGrowth + volatilityBias) + modeledContribution, 0);
    benchmark = Math.max(benchmark * (1 + monthlyGrowth) + modeledContribution, 0);

    rows.push({
      label: month.label,
      investment,
      benchmark,
    });
  }

  const last = rows[rows.length - 1];
  if (last && last.investment > 0) {
    const adjust = currentInvestmentValue / last.investment;
    return rows.map((row) => ({
      ...row,
      investment: row.investment * adjust,
      benchmark: row.benchmark * adjust,
    }));
  }

  return rows;
};

export const estimateRiskScore = (params: {
  utilizationPct: number | null;
  monthlyFlow: MonthlyFlow[];
  emergencyFundMonths: number;
}): number => {
  const { utilizationPct, monthlyFlow, emergencyFundMonths } = params;
  const avgNet =
    monthlyFlow.reduce((total, month) => total + month.net, 0) /
    Math.max(1, monthlyFlow.length);

  const volatility = Math.sqrt(
    monthlyFlow.reduce((total, month) => total + (month.net - avgNet) ** 2, 0) /
      Math.max(1, monthlyFlow.length),
  );

  let score = 55;

  if (utilizationPct !== null) {
    if (utilizationPct < 20) score += 15;
    else if (utilizationPct < 30) score += 8;
    else if (utilizationPct > 45) score -= 15;
    else score -= 6;
  }

  if (avgNet > 0) score += 12;
  else score -= 12;

  if (volatility > 1200) score -= 10;
  else if (volatility < 600) score += 8;

  if (emergencyFundMonths >= 4) score += 12;
  else if (emergencyFundMonths < 2) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
};

