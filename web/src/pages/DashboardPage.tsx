import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PlaidConnectCard } from "../components/PlaidConnectCard";
import { LoadingState } from "../components/LoadingState";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { api } from "../lib/api";
import { formatCurrency, percentLabel } from "../lib/format";
import type { DashboardResponse, Insight } from "../types/api";

const severityLabelMap: Record<Insight["severity"], string> = {
  info: "Info",
  success: "Positive",
  warning: "Attention",
};

const tooltipFormatter = (value: unknown): string => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return formatCurrency(Number.isFinite(numericValue) ? numericValue : 0);
};

export const DashboardPage = () => {
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await api.get<DashboardResponse>("/finance/dashboard");
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

  const onLinked = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["insights"] }),
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
    ]);
  };

  const topCategories = useMemo(() => dashboardQuery.data?.topSpendingCategories ?? [], [dashboardQuery.data]);

  if (dashboardQuery.isLoading) {
    return <LoadingState label="Loading your financial dashboard..." />;
  }

  if (!dashboardQuery.data) {
    return <p className="error-text">Could not load dashboard data.</p>;
  }

  const dashboard = dashboardQuery.data;

  return (
    <div className="page-grid">
      <section className="stat-grid">
        <StatCard
          label="Net worth"
          value={formatCurrency(dashboard.totals.netWorth)}
          tone={dashboard.totals.netWorth >= 0 ? "positive" : "warning"}
          hint="Updated from linked account balances"
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Month income"
          value={formatCurrency(dashboard.cashFlow.monthIncome)}
          tone="positive"
          hint="Detected deposits and inflows"
        />
        <StatCard
          label="Month spend"
          value={formatCurrency(dashboard.cashFlow.monthSpend)}
          hint={`vs last month: ${percentLabel(dashboard.cashFlow.spendChangePct)}`}
          tone={dashboard.cashFlow.monthSpend > dashboard.cashFlow.monthIncome ? "warning" : "neutral"}
        />
        <StatCard
          label="Credit utilization"
          value={percentLabel(dashboard.credit.utilizationPct)}
          hint={formatCurrency(dashboard.credit.revolvingBalance)}
          tone={dashboard.credit.utilizationPct !== null && dashboard.credit.utilizationPct > 30 ? "warning" : "neutral"}
        />
      </section>

      <PlaidConnectCard onLinked={onLinked} />

      <SectionCard
        title="Spending categories"
        subtitle="Top spending areas this month"
        action={
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      >
        {topCategories.length === 0 ? (
          <p className="muted-text">No spending categories available yet. Connect accounts or seed demo data.</p>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topCategories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={tooltipFormatter} />
                <Bar dataKey="amount" fill="#2f6fed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="AI Highlights"
        subtitle="Explainable insights generated from your latest account data"
      >
        {insightsQuery.isLoading ? <LoadingState label="Generating insights..." /> : null}
        {insightsQuery.data?.length ? (
          <ul className="insight-list">
            {insightsQuery.data.map((insight) => (
              <li key={insight.id} className={`insight-card ${insight.severity}`}>
                <div className="insight-header">
                  <span>{insight.title}</span>
                  <span className="pill">{severityLabelMap[insight.severity]}</span>
                </div>
                <p>{insight.message}</p>
                <small>
                  Confidence {(insight.confidence * 100).toFixed(0)}% • Sources:{" "}
                  {insight.dataReferences.join(", ")}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No insights yet. Link accounts to unlock AI recommendations.</p>
        )}
      </SectionCard>

      <SectionCard title="Quick actions" subtitle="Common workflows for faster activation">
        <div className="quick-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              await api.post("/finance/demo-seed", { resetExisting: false });
              await onLinked();
            }}
          >
            <ArrowUpRight size={16} />
            Load demo financial dataset
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              await api.post("/plaid/sync", {});
              await onLinked();
            }}
          >
            <RefreshCw size={16} />
            Sync linked institutions
          </button>
        </div>
      </SectionCard>
    </div>
  );
};

