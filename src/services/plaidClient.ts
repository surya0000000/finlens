import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

import { env } from "../config/env";

const plaidBasePath = PlaidEnvironments[env.PLAID_ENV];

if (!plaidBasePath) {
  throw new Error(`Unsupported Plaid environment: ${env.PLAID_ENV}`);
}

const plaidConfig = new Configuration({
  basePath: plaidBasePath,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
      "PLAID-SECRET": env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

export const plaidClient = new PlaidApi(plaidConfig);

export const plaidDefaults = {
  products: env.plaidProducts as Products[],
  countryCodes: env.plaidCountryCodes as CountryCode[],
};

