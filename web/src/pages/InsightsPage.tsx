import dayjs from "dayjs";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LoadingState } from "../components/LoadingState";
import { api } from "../lib/api";
import {
  buildCategoryTrend,
  buildInvestmentVsBenchmark,
  buildMonthlyFlow,
  estimateRiskScore,
} from "../lib/analytics";
import { formatCurrency, formatPercent } from "../lib/format";
import type {
  Account,
  DashboardResponse,
  SubscriptionsResponse,
  TransactionsResponse,
} from "../types/api";

const chartColors = ["#5f73f8", "#36ba91", "#9b8cf2"];

const tooltipFormatter = (value: unknown): string => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return formatCurrency(Number.isFinite(numericValue) ? numericValue : 0);
};

export const InsightsPage = () => {
  const [scenarioReductionPct, setScenarioReductionPct] = useState(15);
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
    queryKey: ["transactions", "analytics", fromDate],
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

  const isLoading =
    dashboardQuery.isLoading ||
    accountsQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    transactionsQuery.isLoading;

  if (isLoading) {
    return <LoadingState label="Preparing deep analytics..." />;
  }

  if (!dashboardQuery.data || !accountsQuery.data || !subscriptionsQuery.data) {
    return <p className="error-text">Unable to load analytics data.</p>;
  }

  const dashboard = dashboardQuery.data;
  const accounts = accountsQuery.data;
  const subscriptions = subscriptionsQuery.data;
  const transactions = transactionsQuery.data?.transactions ?? [];

  const monthlyFlow = buildMonthlyFlow(transactions, 12);
  const categoryTrend = buildCategoryTrend(transactions, 6, 3);
  const categoryKeys = Object.keys(categoryTrend[0] ?? {}).filter((key) => key !== "label");
  const investmentBalance = accounts
    .filter((account) => account.type.toLowerCase() === "investment")
    .reduce((total, account) => total + Math.max(account.currentBalance, 0), 0);
  const investmentVsBenchmark = buildInvestmentVsBenchmark(monthlyFlow, investmentBalance);

  const emergencyFundMonths =
    dashboard.cashFlow.projected30dOutflow > 0
      ? dashboard.totals.cash / dashboard.cashFlow.projected30dOutflow
      : 0;
  const riskScore = estimateRiskScore({
    utilizationPct: dashboard.credit.utilizationPct,
    monthlyFlow,
    emergencyFundMonths,
  });

  const riskGaugeData = [{ name: "risk", value: riskScore, fill: "#6174f8" }];

  const subscriptionProjection = Array.from({ length: 5 }, (_, index) => {
    const year = index + 1;
    const inflation = 1 + index * 0.04;
    return {
      year: `Y${year}`,
      cost: subscriptions.totals.estimatedYearlyCost * inflation,
    };
  });

  const currentMonthDiscretionarySpend = transactions
    .filter((transaction) => dayjs(transaction.date).isSame(dayjs(), "month"))
    .filter((transaction) =>
      ["FOOD_AND_DRINK", "ENTERTAINMENT", "PERSONAL_CARE", "GENERAL_MERCHANDISE"].includes(
        transaction.primaryCategory ?? "",
      ),
    )
    .reduce((total, transaction) => total + Math.max(transaction.amount, 0), 0);

  const modeledMonthlySavings =
    (currentMonthDiscretionarySpend + subscriptions.totals.estimatedMonthlyCost) *
    (scenarioReductionPct / 100);
  const modeledYearlySavings = modeledMonthlySavings * 12;

  return (
    <div className="analytics-layout">
      <section className="panel analytics-panel">
        <header className="panel-header">
          <div>
            <h3>Cash Flow Breakdown</h3>
            <p>Monthly income and expense dynamics.</p>
          </div>
        </header>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={monthlyFlow}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="income" fill="#33ae7e" radius={[5, 5, 0, 0]} />
            <Bar dataKey="expense" fill="#a96a7b" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel analytics-panel">
        <header className="panel-header">
          <div>
            <h3>Category Trends</h3>
            <p>Spend concentration across top categories.</p>
          </div>
        </header>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={categoryTrend}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={tooltipFormatter} />
            {categoryKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[index % chartColors.length]}
                strokeWidth={1.8}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel analytics-panel">
        <header className="panel-header">
          <div>
            <h3>Investment vs Benchmark</h3>
            <p>Portfolio trajectory compared to modeled baseline.</p>
          </div>
        </header>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={investmentVsBenchmark}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={tooltipFormatter} />
            <Area
              type="monotone"
              dataKey="benchmark"
              stroke="#8f9cae"
              fill="rgba(143, 156, 174, 0.1)"
              strokeWidth={1.3}
            />
            <Area
              type="monotone"
              dataKey="investment"
              stroke="#4f63f7"
              fill="rgba(79, 99, 247, 0.16)"
              strokeWidth={1.8}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="panel analytics-panel gauge-panel">
        <header className="panel-header">
          <div>
            <h3>Risk Score</h3>
            <p>Composite signal from utilization, cash flow, and volatility.</p>
          </div>
        </header>
        <div className="risk-gauge-wrap">
          <ResponsiveContainer width="100%" height={210}>
            <RadialBarChart
              cx="50%"
              cy="85%"
              innerRadius="70%"
              outerRadius="110%"
              barSize={14}
              startAngle={180}
              endAngle={0}
              data={riskGaugeData}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="risk-score">
            <strong>{riskScore}</strong>
            <span>/100</span>
            <p>{riskScore >= 70 ? "Stable posture" : riskScore >= 45 ? "Moderate risk" : "High risk state"}</p>
          </div>
        </div>
      </section>

      <section className="panel analytics-panel">
        <header className="panel-header">
          <div>
            <h3>Subscription Lifetime Projection</h3>
            <p>Projected cost with a conservative inflation model.</p>
          </div>
        </header>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={subscriptionProjection}>
            <XAxis dataKey="year" axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="cost" fill="#7f8ce9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel analytics-panel scenario-panel">
        <header className="panel-header">
          <div>
            <h3>Scenario Modeling</h3>
            <p>Simulate discretionary + recurring spend optimization.</p>
          </div>
        </header>
        <div className="scenario-slider-wrap">
          <label htmlFor="scenarioRange">
            Spend reduction target: <strong>{scenarioReductionPct}%</strong>
          </label>
          <input
            id="scenarioRange"
            type="range"
            min={0}
            max={40}
            value={scenarioReductionPct}
            onChange={(event) => setScenarioReductionPct(Number(event.target.value))}
          />
          <div className="scenario-results">
            <div>
              <span>Modeled monthly savings</span>
              <strong>{formatCurrency(modeledMonthlySavings)}</strong>
            </div>
            <div>
              <span>Modeled annual savings</span>
              <strong>{formatCurrency(modeledYearlySavings)}</strong>
            </div>
            <div>
              <span>Emergency runway impact</span>
              <strong>
                +{formatPercent((modeledMonthlySavings / Math.max(1, dashboard.cashFlow.projected30dOutflow)) * 100, 1)}
              </strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

