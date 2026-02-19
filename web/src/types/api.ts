export type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type DashboardResponse = {
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
  topSpendingCategories: Array<{
    category: string;
    amount: number;
    transactionCount: number;
  }>;
  accountsCount: number;
};

export type Insight = {
  id: string;
  severity: "info" | "success" | "warning";
  title: string;
  message: string;
  confidence: number;
  dataReferences: string[];
};

export type Account = {
  id: string;
  plaidAccountId: string;
  plaidItemId: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number;
  availableBalance: number | null;
  isoCurrencyCode: string | null;
  unofficialCurrencyCode: string | null;
};

export type PlaidItem = {
  id: string;
  plaidItemId: string;
  institutionId: string | null;
  institutionName: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
};

export type Transaction = {
  id: string;
  plaidTransactionId: string;
  accountId: string;
  accountName: string;
  accountMask: string | null;
  accountType: string;
  amount: number;
  date: string;
  authorizedDate: string | null;
  pending: boolean;
  paymentChannel: string | null;
  name: string;
  merchantName: string | null;
  primaryCategory: string | null;
  detailedCategory: string | null;
};

export type TransactionsResponse = {
  page: number;
  pageSize: number;
  totalCount: number;
  transactions: Transaction[];
};

export type Subscription = {
  merchant: string;
  cadence: "weekly" | "biweekly" | "monthly";
  averageAmount: number;
  estimatedMonthlyCost: number;
  lastChargeDate: string;
  nextExpectedChargeDate: string;
  confidence: number;
  chargeCount: number;
};

export type SubscriptionsResponse = {
  subscriptions: Subscription[];
  totals: {
    estimatedMonthlyCost: number;
    estimatedYearlyCost: number;
  };
};

export type AdvisorResponse = {
  answer: string;
  citations: string[];
  actions: string[];
  generatedBy: "openai" | "rule-engine";
  timestamp: string;
};

