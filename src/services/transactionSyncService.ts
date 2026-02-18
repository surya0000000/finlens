import { Prisma } from "@prisma/client";
import { Transaction as PlaidTransaction } from "plaid";

import { prisma } from "../lib/prisma";
import { parsePlaidDate } from "../utils/date";
import { HttpError } from "../utils/httpError";
import { decryptString } from "../utils/crypto";
import { plaidClient } from "./plaidClient";

const toJson = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
};

const upsertAccountsForItem = async (params: {
  userId: string;
  plaidItemId: string;
  accessToken: string;
}): Promise<Map<string, string>> => {
  const { userId, plaidItemId, accessToken } = params;

  const accountResponse = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  await Promise.all(
    accountResponse.data.accounts.map((account) =>
      prisma.account.upsert({
        where: { plaidAccountId: account.account_id },
        create: {
          userId,
          plaidItemId,
          plaidAccountId: account.account_id,
          name: account.name,
          mask: account.mask ?? null,
          type: account.type,
          subtype: account.subtype ?? null,
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available ?? null,
          isoCurrencyCode: account.balances.iso_currency_code ?? null,
          unofficialCurrencyCode: account.balances.unofficial_currency_code ?? null,
        },
        update: {
          userId,
          plaidItemId,
          name: account.name,
          mask: account.mask ?? null,
          type: account.type,
          subtype: account.subtype ?? null,
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available ?? null,
          isoCurrencyCode: account.balances.iso_currency_code ?? null,
          unofficialCurrencyCode: account.balances.unofficial_currency_code ?? null,
        },
      }),
    ),
  );

  const accounts = await prisma.account.findMany({
    where: {
      userId,
      plaidItemId,
    },
    select: {
      id: true,
      plaidAccountId: true,
    },
  });

  return new Map(accounts.map((account) => [account.plaidAccountId, account.id]));
};

const ensureAccountId = async (params: {
  userId: string;
  plaidItemId: string;
  plaidAccountId: string;
  accountMap: Map<string, string>;
}): Promise<string> => {
  const existingId = params.accountMap.get(params.plaidAccountId);

  if (existingId) {
    return existingId;
  }

  const account = await prisma.account.upsert({
    where: { plaidAccountId: params.plaidAccountId },
    create: {
      userId: params.userId,
      plaidItemId: params.plaidItemId,
      plaidAccountId: params.plaidAccountId,
      name: "Unclassified Account",
      type: "other",
      currentBalance: 0,
    },
    update: {},
    select: { id: true },
  });

  params.accountMap.set(params.plaidAccountId, account.id);
  return account.id;
};

const upsertTransactions = async (params: {
  userId: string;
  plaidItemId: string;
  accountMap: Map<string, string>;
  transactions: PlaidTransaction[];
}): Promise<void> => {
  const { userId, plaidItemId, accountMap, transactions } = params;

  for (const transaction of transactions) {
    const accountId = await ensureAccountId({
      userId,
      plaidItemId,
      plaidAccountId: transaction.account_id,
      accountMap,
    });

    await prisma.transaction.upsert({
      where: { plaidTransactionId: transaction.transaction_id },
      create: {
        userId,
        plaidItemId,
        accountId,
        plaidTransactionId: transaction.transaction_id,
        pendingTransactionId: transaction.pending_transaction_id ?? null,
        amount: transaction.amount,
        isoCurrencyCode: transaction.iso_currency_code ?? null,
        unofficialCurrencyCode: transaction.unofficial_currency_code ?? null,
        date: parsePlaidDate(transaction.date) ?? new Date(),
        authorizedDate: parsePlaidDate(transaction.authorized_date) ?? null,
        pending: transaction.pending,
        paymentChannel: transaction.payment_channel ?? null,
        name: transaction.name,
        merchantName: transaction.merchant_name ?? null,
        primaryCategory: transaction.personal_finance_category?.primary ?? null,
        detailedCategory: transaction.personal_finance_category?.detailed ?? null,
        locationJson: toJson(transaction.location),
        counterpartiesJson: toJson(transaction.counterparties),
        rawJson: toJson(transaction),
      },
      update: {
        accountId,
        pendingTransactionId: transaction.pending_transaction_id ?? null,
        amount: transaction.amount,
        isoCurrencyCode: transaction.iso_currency_code ?? null,
        unofficialCurrencyCode: transaction.unofficial_currency_code ?? null,
        date: parsePlaidDate(transaction.date) ?? new Date(),
        authorizedDate: parsePlaidDate(transaction.authorized_date) ?? null,
        pending: transaction.pending,
        paymentChannel: transaction.payment_channel ?? null,
        name: transaction.name,
        merchantName: transaction.merchant_name ?? null,
        primaryCategory: transaction.personal_finance_category?.primary ?? null,
        detailedCategory: transaction.personal_finance_category?.detailed ?? null,
        locationJson: toJson(transaction.location),
        counterpartiesJson: toJson(transaction.counterparties),
        rawJson: toJson(transaction),
      },
    });
  }
};

type SyncStats = {
  added: number;
  modified: number;
  removed: number;
};

export const syncSinglePlaidItem = async (
  userId: string,
  plaidItemRecordId: string,
): Promise<SyncStats> => {
  const item = await prisma.plaidItem.findFirst({
    where: {
      id: plaidItemRecordId,
      userId,
    },
  });

  if (!item) {
    throw new HttpError(404, "Plaid item not found.");
  }

  const accessToken = decryptString(item.accessTokenEncrypted);
  const accountMap = await upsertAccountsForItem({
    userId,
    plaidItemId: item.id,
    accessToken,
  });

  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;

  while (hasMore) {
    const syncResponse = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 100,
    });

    const { added, modified, removed, next_cursor: nextCursor, has_more: morePages } =
      syncResponse.data;

    if (added.length) {
      await upsertTransactions({
        userId,
        plaidItemId: item.id,
        accountMap,
        transactions: added,
      });
      addedCount += added.length;
    }

    if (modified.length) {
      await upsertTransactions({
        userId,
        plaidItemId: item.id,
        accountMap,
        transactions: modified,
      });
      modifiedCount += modified.length;
    }

    if (removed.length) {
      const removedIds = removed.map((entry) => entry.transaction_id);
      await prisma.transaction.deleteMany({
        where: {
          userId,
          plaidItemId: item.id,
          plaidTransactionId: {
            in: removedIds,
          },
        },
      });
      removedCount += removed.length;
    }

    cursor = nextCursor;
    hasMore = morePages;
  }

  await prisma.plaidItem.update({
    where: { id: item.id },
    data: {
      cursor,
      lastSyncedAt: new Date(),
    },
  });

  return {
    added: addedCount,
    modified: modifiedCount,
    removed: removedCount,
  };
};

export const syncAllPlaidItemsForUser = async (userId: string): Promise<{
  syncedItems: number;
  totalAdded: number;
  totalModified: number;
  totalRemoved: number;
}> => {
  const items = await prisma.plaidItem.findMany({
    where: { userId },
    select: { id: true },
  });

  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  for (const item of items) {
    const result = await syncSinglePlaidItem(userId, item.id);
    totalAdded += result.added;
    totalModified += result.modified;
    totalRemoved += result.removed;
  }

  return {
    syncedItems: items.length,
    totalAdded,
    totalModified,
    totalRemoved,
  };
};

export const calculateForecastBurnRate = (transactions: Array<{ amount: number; date: Date }>): {
  avgDailyOutflow: number;
  projected30dOutflow: number;
} => {
  if (!transactions.length) {
    return {
      avgDailyOutflow: 0,
      projected30dOutflow: 0,
    };
  }

  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sorted[0]?.date ?? new Date();
  const lastDate = sorted[sorted.length - 1]?.date ?? new Date();
  const observedDays = Math.max(
    1,
    Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  const totalOutflow = sorted
    .filter((transaction) => transaction.amount > 0)
    .reduce((accumulator, transaction) => accumulator + transaction.amount, 0);

  const avgDailyOutflow = totalOutflow / observedDays;
  return {
    avgDailyOutflow,
    projected30dOutflow: avgDailyOutflow * 30,
  };
};

