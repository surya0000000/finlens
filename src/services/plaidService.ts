import { CountryCode } from "plaid";

import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { encryptString } from "../utils/crypto";
import { HttpError } from "../utils/httpError";
import { plaidClient, plaidDefaults } from "./plaidClient";
import { syncSinglePlaidItem } from "./transactionSyncService";

type ExchangePublicTokenInput = {
  userId: string;
  publicToken: string;
  institutionName?: string;
};

export const createPlaidLinkToken = async (userId: string): Promise<{
  linkToken: string;
  expiration: string;
}> => {
  const linkTokenPayload = {
    client_name: "FinLens X",
    language: "en",
    country_codes: plaidDefaults.countryCodes as CountryCode[],
    user: {
      client_user_id: userId,
    },
    products: plaidDefaults.products,
    redirect_uri: env.plaidRedirectUri,
  };

  const linkTokenResponse = await plaidClient.linkTokenCreate(linkTokenPayload);

  return {
    linkToken: linkTokenResponse.data.link_token,
    expiration: linkTokenResponse.data.expiration,
  };
};

const resolveInstitutionName = async (
  institutionId: string | null | undefined,
  fallbackInstitutionName?: string,
): Promise<string | null> => {
  if (!institutionId) {
    return fallbackInstitutionName ?? null;
  }

  try {
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: plaidDefaults.countryCodes as CountryCode[],
    });
    return institutionResponse.data.institution.name;
  } catch {
    return fallbackInstitutionName ?? institutionId;
  }
};

export const exchangePlaidPublicToken = async (input: ExchangePublicTokenInput): Promise<{
  itemId: string;
  plaidItemId: string;
  institutionName: string | null;
  syncStats: {
    added: number;
    modified: number;
    removed: number;
  };
}> => {
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token: input.publicToken,
  });

  const accessToken = exchangeResponse.data.access_token;
  const plaidItemId = exchangeResponse.data.item_id;

  const itemDetailsResponse = await plaidClient.itemGet({
    access_token: accessToken,
  });

  const institutionId = itemDetailsResponse.data.item.institution_id ?? null;
  const institutionName = await resolveInstitutionName(institutionId, input.institutionName);

  const item = await prisma.plaidItem.upsert({
    where: { plaidItemId },
    create: {
      userId: input.userId,
      plaidItemId,
      accessTokenEncrypted: encryptString(accessToken),
      institutionId,
      institutionName,
      cursor: null,
    },
    update: {
      userId: input.userId,
      accessTokenEncrypted: encryptString(accessToken),
      institutionId,
      institutionName,
      cursor: null,
    },
  });

  const syncStats = await syncSinglePlaidItem(input.userId, item.id);

  return {
    itemId: item.id,
    plaidItemId,
    institutionName,
    syncStats,
  };
};

export const listPlaidItemsForUser = async (userId: string): Promise<
  Array<{
    id: string;
    plaidItemId: string;
    institutionId: string | null;
    institutionName: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastSyncedAt: Date | null;
  }>
> =>
  prisma.plaidItem.findMany({
    where: { userId },
    select: {
      id: true,
      plaidItemId: true,
      institutionId: true,
      institutionName: true,
      createdAt: true,
      updatedAt: true,
      lastSyncedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

export const createSandboxPublicToken = async (institutionId?: string): Promise<string> => {
  if (env.PLAID_ENV !== "sandbox") {
    throw new HttpError(400, "Sandbox public token helper is only available in PLAID_ENV=sandbox.");
  }

  const sandboxResponse = await plaidClient.sandboxPublicTokenCreate({
    institution_id: institutionId ?? "ins_109508",
    initial_products: plaidDefaults.products,
  });

  return sandboxResponse.data.public_token;
};

