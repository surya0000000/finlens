import { prisma } from "../lib/prisma";
import { encryptString } from "../utils/crypto";

type SeedDemoDataInput = {
  userId: string;
  resetExisting?: boolean;
};

const dayMs = 24 * 60 * 60 * 1000;

const daysAgo = (days: number): Date => new Date(Date.now() - days * dayMs);

const toPlaidDate = (date: Date): string => date.toISOString().slice(0, 10);

const stableRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const category = {
  income: {
    primary: "INCOME",
    detailed: "INCOME_WAGES",
  },
  rent: {
    primary: "RENT_AND_UTILITIES",
    detailed: "RENT_AND_UTILITIES_RENT",
  },
  groceries: {
    primary: "FOOD_AND_DRINK",
    detailed: "FOOD_AND_DRINK_GROCERIES",
  },
  dining: {
    primary: "FOOD_AND_DRINK",
    detailed: "FOOD_AND_DRINK_RESTAURANT",
  },
  utility: {
    primary: "RENT_AND_UTILITIES",
    detailed: "RENT_AND_UTILITIES_ELECTRIC",
  },
  subscription: {
    primary: "ENTERTAINMENT",
    detailed: "ENTERTAINMENT_STREAMING",
  },
  transfer: {
    primary: "TRANSFER_OUT",
    detailed: "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
  },
};

type DraftTx = {
  plaidTransactionId: string;
  accountId: string;
  plaidItemId: string;
  amount: number;
  date: Date;
  name: string;
  merchantName: string;
  pending?: boolean;
  paymentChannel?: string;
  primaryCategory?: string;
  detailedCategory?: string;
};

const upsertDraftTransactions = async (
  userId: string,
  transactions: DraftTx[],
): Promise<{ inserted: number }> => {
  let inserted = 0;

  for (const transaction of transactions) {
    await prisma.transaction.upsert({
      where: { plaidTransactionId: transaction.plaidTransactionId },
      create: {
        userId,
        plaidItemId: transaction.plaidItemId,
        accountId: transaction.accountId,
        plaidTransactionId: transaction.plaidTransactionId,
        pendingTransactionId: null,
        amount: transaction.amount,
        isoCurrencyCode: "USD",
        unofficialCurrencyCode: null,
        date: transaction.date,
        authorizedDate: transaction.date,
        pending: transaction.pending ?? false,
        paymentChannel: transaction.paymentChannel ?? "online",
        name: transaction.name,
        merchantName: transaction.merchantName,
        primaryCategory: transaction.primaryCategory ?? null,
        detailedCategory: transaction.detailedCategory ?? null,
        rawJson: {
          source: "demo-seed",
          date: toPlaidDate(transaction.date),
        },
      },
      update: {},
    });

    inserted += 1;
  }

  return { inserted };
};

export const seedDemoDataForUser = async (
  input: SeedDemoDataInput,
): Promise<{ insertedTransactions: number; insertedAccounts: number; skipped: boolean }> => {
  const { userId, resetExisting = false } = input;

  const demoItem = await prisma.plaidItem.upsert({
    where: {
      plaidItemId: `demo_item_${userId}`,
    },
    create: {
      userId,
      plaidItemId: `demo_item_${userId}`,
      accessTokenEncrypted: encryptString(`demo_access_token_${userId}`),
      institutionId: "demo_sandbox",
      institutionName: "FinLens Demo Bank",
      cursor: null,
      lastSyncedAt: new Date(),
    },
    update: {
      userId,
      institutionName: "FinLens Demo Bank",
      lastSyncedAt: new Date(),
    },
  });

  if (resetExisting) {
    await prisma.transaction.deleteMany({
      where: {
        userId,
        plaidItemId: demoItem.id,
      },
    });
    await prisma.account.deleteMany({
      where: {
        userId,
        plaidItemId: demoItem.id,
      },
    });
  } else {
    const existingCount = await prisma.transaction.count({
      where: {
        userId,
        plaidItemId: demoItem.id,
      },
    });

    if (existingCount > 0) {
      return {
        insertedTransactions: 0,
        insertedAccounts: 0,
        skipped: true,
      };
    }
  }

  const accountDrafts = [
    {
      key: "checking",
      name: "FinLens Checking",
      type: "depository",
      subtype: "checking",
      currentBalance: 7485.24,
      availableBalance: 7485.24,
    },
    {
      key: "credit",
      name: "FinLens Rewards Card",
      type: "credit",
      subtype: "credit card",
      currentBalance: 1843.32,
      availableBalance: 5656.68,
    },
    {
      key: "investment",
      name: "FinLens ETF Portfolio",
      type: "investment",
      subtype: "brokerage",
      currentBalance: 15240.45,
      availableBalance: null,
    },
  ] as const;

  const accountMap = new Map<string, string>();

  for (const draft of accountDrafts) {
    const account = await prisma.account.upsert({
      where: {
        plaidAccountId: `demo_${userId}_${draft.key}`,
      },
      create: {
        userId,
        plaidItemId: demoItem.id,
        plaidAccountId: `demo_${userId}_${draft.key}`,
        name: draft.name,
        mask: draft.key === "checking" ? "0001" : draft.key === "credit" ? "9001" : "4301",
        type: draft.type,
        subtype: draft.subtype,
        currentBalance: draft.currentBalance,
        availableBalance: draft.availableBalance,
        isoCurrencyCode: "USD",
      },
      update: {
        name: draft.name,
        type: draft.type,
        subtype: draft.subtype,
        currentBalance: draft.currentBalance,
        availableBalance: draft.availableBalance,
        isoCurrencyCode: "USD",
      },
      select: { id: true },
    });

    accountMap.set(draft.key, account.id);
  }

  const checkingId = accountMap.get("checking");
  const creditId = accountMap.get("credit");
  const investmentId = accountMap.get("investment");

  if (!checkingId || !creditId || !investmentId) {
    throw new Error("Failed to create demo accounts.");
  }

  const transactions: DraftTx[] = [];

  for (let day = 0; day < 120; day += 1) {
    const date = daysAgo(day);
    const seed = day + 41;

    if (day % 14 === 0) {
      transactions.push({
        plaidTransactionId: `demo_tx_income_${day}`,
        accountId: checkingId,
        plaidItemId: demoItem.id,
        amount: -3650,
        date,
        name: "Payroll Deposit",
        merchantName: "Acme Technologies Payroll",
        primaryCategory: category.income.primary,
        detailedCategory: category.income.detailed,
        paymentChannel: "other",
      });
    }

    if (day % 30 === 2) {
      transactions.push({
        plaidTransactionId: `demo_tx_rent_${day}`,
        accountId: checkingId,
        plaidItemId: demoItem.id,
        amount: 1725,
        date,
        name: "Apartment Rent",
        merchantName: "Lakeside Apartments",
        primaryCategory: category.rent.primary,
        detailedCategory: category.rent.detailed,
      });
    }

    if (day % 7 === 3) {
      const groceriesAmount = 95 + Math.round(stableRandom(seed) * 75);
      transactions.push({
        plaidTransactionId: `demo_tx_grocery_${day}`,
        accountId: creditId,
        plaidItemId: demoItem.id,
        amount: groceriesAmount,
        date,
        name: "Grocery Purchase",
        merchantName: "Whole Foods",
        primaryCategory: category.groceries.primary,
        detailedCategory: category.groceries.detailed,
        paymentChannel: "in store",
      });
    }

    if (day % 5 === 1) {
      const diningAmount = 22 + Math.round(stableRandom(seed * 3) * 58);
      transactions.push({
        plaidTransactionId: `demo_tx_dining_${day}`,
        accountId: creditId,
        plaidItemId: demoItem.id,
        amount: diningAmount,
        date,
        name: "Restaurant",
        merchantName: "Urban Bites",
        primaryCategory: category.dining.primary,
        detailedCategory: category.dining.detailed,
        paymentChannel: "in store",
      });
    }

    if (day % 30 === 6) {
      transactions.push({
        plaidTransactionId: `demo_tx_electric_${day}`,
        accountId: checkingId,
        plaidItemId: demoItem.id,
        amount: 148.45,
        date,
        name: "Electric Bill",
        merchantName: "Austin Energy",
        primaryCategory: category.utility.primary,
        detailedCategory: category.utility.detailed,
      });
    }

    if (day % 30 === 8) {
      transactions.push({
        plaidTransactionId: `demo_tx_netflix_${day}`,
        accountId: creditId,
        plaidItemId: demoItem.id,
        amount: 15.99,
        date,
        name: "Netflix Subscription",
        merchantName: "Netflix",
        primaryCategory: category.subscription.primary,
        detailedCategory: category.subscription.detailed,
        paymentChannel: "online",
      });
    }

    if (day % 30 === 10) {
      transactions.push({
        plaidTransactionId: `demo_tx_spotify_${day}`,
        accountId: creditId,
        plaidItemId: demoItem.id,
        amount: 11.99,
        date,
        name: "Spotify Premium",
        merchantName: "Spotify",
        primaryCategory: category.subscription.primary,
        detailedCategory: category.subscription.detailed,
        paymentChannel: "online",
      });
    }

    if (day % 30 === 12) {
      transactions.push({
        plaidTransactionId: `demo_tx_gym_${day}`,
        accountId: creditId,
        plaidItemId: demoItem.id,
        amount: 49,
        date,
        name: "Gym Membership",
        merchantName: "FitLife Gym",
        primaryCategory: "PERSONAL_CARE",
        detailedCategory: "PERSONAL_CARE_GYM_AND_FITNESS",
      });
    }

    if (day % 30 === 13) {
      transactions.push({
        plaidTransactionId: `demo_tx_invest_${day}`,
        accountId: checkingId,
        plaidItemId: demoItem.id,
        amount: 350,
        date,
        name: "Investment Transfer",
        merchantName: "FinLens Brokerage Transfer",
        primaryCategory: category.transfer.primary,
        detailedCategory: category.transfer.detailed,
      });
      transactions.push({
        plaidTransactionId: `demo_tx_invest_credit_${day}`,
        accountId: investmentId,
        plaidItemId: demoItem.id,
        amount: -350,
        date,
        name: "Investment Contribution",
        merchantName: "FinLens Brokerage Transfer",
        primaryCategory: "INCOME",
        detailedCategory: "INCOME_OTHER_INCOME",
      });
    }
  }

  const result = await upsertDraftTransactions(userId, transactions);

  await prisma.plaidItem.update({
    where: { id: demoItem.id },
    data: {
      lastSyncedAt: new Date(),
    },
  });

  return {
    insertedTransactions: result.inserted,
    insertedAccounts: accountDrafts.length,
    skipped: false,
  };
};

