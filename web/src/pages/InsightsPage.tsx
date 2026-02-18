import { useQuery } from "@tanstack/react-query";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

import { LoadingState } from "../components/LoadingState";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { DashboardResponse, Insight } from "../types/api";

const palette = ["#2f6fed", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

export const InsightsPage = (): JSX.Element => {
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

  if (dashboardQuery.isLoading || insightsQuery.isLoading) {
    return <LoadingState label="Preparing your insights..." />;
  }

  return (
    <div className="page-grid">
      <SectionCard title="Spending composition" subtitle="Share of top categories this month">
        {dashboardQuery.data?.topSpendingCategories.length ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={dashboardQuery.data.topSpendingCategories}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                >
                  {dashboardQuery.data.topSpendingCategories.map((entry, index) => (
                    <Cell key={entry.category} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="muted-text">No category data available yet.</p>
        )}
      </SectionCard>

      <SectionCard title="Explainable insights" subtitle="Reasoned signals generated from your financial model">
        {insightsQuery.data?.length ? (
          <ul className="insight-list">
            {insightsQuery.data.map((insight) => (
              <li key={insight.id} className={`insight-card ${insight.severity}`}>
                <div className="insight-header">
                  <strong>{insight.title}</strong>
                  <span className="pill">{Math.round(insight.confidence * 100)}% confidence</span>
                </div>
                <p>{insight.message}</p>
                <small>Sources: {insight.dataReferences.join(", ")}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No insights generated for this user yet.</p>
        )}
      </SectionCard>
    </div>
  );
};

