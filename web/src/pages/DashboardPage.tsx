import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LoadingState } from "../components/LoadingState";
import { PlaidConnectCard } from "../components/PlaidConnectCard";
import { api } from "../lib/api";
import {
  buildAssetAllocation,
  buildMonthlyFlow,
  buildNetWorthTrend,
} from "../lib/analytics";
import { formatCurrency, formatPercent, formatSignedCurrency } from "../lib/format";
import type {
  Account,
  DashboardResponse,
  Insight,
  SubscriptionsResponse,
  TransactionsResponse,
} from "../types/api";

const palette = ["#6982ff", "#3dd6a1", "#8b9ff5", "#b9c3ff", "#9bc2d7"];

const tooltipFormatter = (value: unknown): string => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return formatCurrency(Number.isFinite(numericValue) ? numericValue : 0);
};

const severityClass: Record<Insight["severity"], string> = {
  info: "neutral",
  success: "positive",
  warning: "warning",
};

export const DashboardPage = () => {
  const queryClient = useQueryClient();
  const fromDate = dayjs().subtract(11, "month").startOf("month").toISOString();

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await api.get<DashboardResponse>("/finance/dashboard");
      return response.data;
    },
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await api.get<{ accounts: Account[] }>("/finance/accounts");
      return response.data.accounts;
    },
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const response = await api.get<SubscriptionsResponse>("/finance/subscriptions");
      return response.data;
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", "command-center", fromDate],
    queryFn: async () => {
      const response = await api.get<TransactionsResponse>("/finance/transactions", {
        params: {
          page: 1,
          pageSize: 200,
          from: fromDate,
        },
      });
      return response.data;
    },
  });

  const insightsQuery = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const response = await api.get<{ insights: Insight[] }>("/finance/insights");
      return response.data.insights;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      await api.post("/finance/demo-seed", { resetExisting: false });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      await api.post("/plaid/sync", {});
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
      ]);
    },
  });

  const isLoading =
    dashboardQuery.isLoading ||
    accountsQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    transactionsQuery.isLoading;

  if (isLoading) {
    return <LoadingState label="Assembling your financial command center..." />;
  }

  if (!dashboardQuery.data) {
    return <p className="error-text">Unable to load dashboard metrics.</p>;
  }

  const dashboard = dashboardQuery.data;
  const accounts = accountsQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data;
  const transactions = transactionsQuery.data?.transactions ?? [];

  const monthlyFlow = buildMonthlyFlow(transactions, 12);
  const netWorthTrend = buildNetWorthTrend(monthlyFlow, dashboard.totals.netWorth);
  const assetAllocation = buildAssetAllocation(accounts);
  const firstNetWorth = netWorthTrend[0]?.netWorth ?? dashboard.totals.netWorth;
  const lastNetWorth = netWorthTrend[netWorthTrend.length - 1]?.netWorth ?? dashboard.totals.netWorth;
  const netWorthGrowthPct =
    firstNetWorth === 0 ? 0 : ((lastNetWorth - firstNetWorth) / Math.abs(firstNetWorth)) * 100;

  const emergencyFundMonths =
    dashboard.cashFlow.projected30dOutflow > 0
      ? dashboard.totals.cash / dashboard.cashFlow.projected30dOutflow
      : 0;

  const accountRollup = [
    {
      label: "Bank Accounts",
      amount: accounts
        .filter((account) => account.type.toLowerCase() === "depository")
        .reduce((total, account) => total + Math.max(account.currentBalance, 0), 0),
    },
    {
      label: "Investments",
      amount: accounts
        .filter((account) => account.type.toLowerCase() === "investment")
        .reduce((total, account) => total + Math.max(account.currentBalance, 0), 0),
    },
    {
      label: "Credit & Loans",
      amount: accounts
        .filter((account) =>
          ["credit", "loan"].includes(account.type.toLowerCase()),
        )
        .reduce((total, account) => total + Math.max(account.currentBalance, 0), 0),
    },
  ];

  return (
    <div className="command-layout">
      <section className="panel hero-panel">
        <div className="hero-metrics">
          <span className="panel-label">Net Worth</span>
          <h1>{formatCurrency(dashboard.totals.netWorth)}</h1>
          <div className="hero-meta">
            <span className={netWorthGrowthPct >= 0 ? "metric-positive" : "metric-negative"}>
              {netWorthGrowthPct >= 0 ? "+" : ""}
              {formatPercent(netWorthGrowthPct, 2)} over 12 months
            </span>
            <span>Cash Flow {formatSignedCurrency(dashboard.cashFlow.monthNet)} this month</span>
          </div>
        </div>
        <div className="hero-chart">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={netWorthTrend}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={tooltipFormatter} />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="#2f3b66"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#4f62e6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="command-actions">
        <PlaidConnectCard
          onLinked={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
              queryClient.invalidateQueries({ queryKey: ["accounts"] }),
              queryClient.invalidateQueries({ queryKey: ["transactions"] }),
              queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
              queryClient.invalidateQueries({ queryKey: ["insights"] }),
            ]);
          }}
        />
        <button
          type="button"
          className="action-button"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
        >
          Load demo dataset
        </button>
        <button
          type="button"
          className="action-button subtle"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw size={14} />
          Sync connected institutions
        </button>
      </section>

      <section className="command-grid">
        <article className="panel">
          <header className="panel-header">
            <div>
              <h3>Asset Allocation</h3>
              <p>Banking, investments, and retirement exposure.</p>
            </div>
          </header>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={assetAllocation}
                  dataKey="value"
                  nameKey="segment"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {assetAllocation.map((entry, index) => (
                    <Cell key={entry.segment} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipFormatter} />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend-list">
              {assetAllocation.map((entry, index) => (
                <div key={entry.segment} className="legend-row">
                  <span
                    className="legend-dot"
                    style={{ backgroundColor: palette[index % palette.length] }}
                  />
                  <span>{entry.segment}</span>
                  <strong>{formatCurrency(entry.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div>
              <h3>Accounts Overview</h3>
              <p>Connected coverage across your financial system.</p>
            </div>
          </header>
          <div className="metric-stack">
            {accountRollup.map((item) => (
              <div key={item.label} className="metric-row">
                <span>{item.label}</span>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
            ))}
            <div className="metric-row">
              <span>Total linked accounts</span>
              <strong>{dashboard.accountsCount}</strong>
            </div>
            <div className="metric-row">
              <span>Emergency fund runway</span>
              <strong>{emergencyFundMonths.toFixed(1)} months</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div>
              <h3>Monthly Cash Flow</h3>
              <p>Income versus expenses across 12 months.</p>
            </div>
          </header>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyFlow}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={tooltipFormatter} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#23a36a"
                  fill="rgba(35, 163, 106, 0.12)"
                  strokeWidth={1.6}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#aa6376"
                  fill="rgba(170, 99, 118, 0.08)"
                  strokeWidth={1.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div>
              <h3>Recurring Spend</h3>
              <p>Subscriptions and yearly impact.</p>
            </div>
          </header>
          <div className="metric-stack">
            <div className="metric-row">
              <span>Active subscriptions</span>
              <strong>{subscriptions?.subscriptions.length ?? 0}</strong>
            </div>
            <div className="metric-row">
              <span>Monthly recurring total</span>
              <strong>{formatCurrency(subscriptions?.totals.estimatedMonthlyCost ?? 0)}</strong>
            </div>
            <div className="metric-row">
              <span>Projected annual cost</span>
              <strong>{formatCurrency(subscriptions?.totals.estimatedYearlyCost ?? 0)}</strong>
            </div>
            <div className="divider" />
            {(subscriptions?.subscriptions ?? []).slice(0, 3).map((subscription) => (
              <div key={subscription.merchant} className="metric-row subtle">
                <span>{subscription.merchant}</span>
                <strong>{formatCurrency(subscription.estimatedMonthlyCost)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel insights-panel">
        <header className="panel-header">
          <div>
            <h3>AI Insights</h3>
            <p>Quiet, contextual observations based on your financial behavior.</p>
          </div>
        </header>
        {insightsQuery.isLoading ? (
          <LoadingState label="Generating insights..." />
        ) : insightsQuery.data?.length ? (
          <div className="insight-grid">
            {insightsQuery.data.map((insight) => (
              <article key={insight.id} className={`insight-note ${severityClass[insight.severity]}`}>
                <h4>{insight.title}</h4>
                <p>{insight.message}</p>
                <small>
                  Confidence {(insight.confidence * 100).toFixed(0)}% •{" "}
                  {insight.dataReferences.join(", ")}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted-text">
            No insights are available yet. Connect data sources to activate AI analysis.
          </p>
        )}
      </section>
    </div>
  );
};

