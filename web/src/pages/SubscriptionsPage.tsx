import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { LoadingState } from "../components/LoadingState";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import type { Subscription, SubscriptionsResponse } from "../types/api";

export const SubscriptionsPage = () => {
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);

  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const response = await api.get<SubscriptionsResponse>("/finance/subscriptions");
      return response.data;
    },
  });

  const simulationMutation = useMutation({
    mutationFn: async (merchantNames: string[]) => {
      const response = await api.post<{
        merchants: string[];
        monthlySavings: number;
        yearlySavings: number;
      }>("/finance/subscriptions/simulate-cancel", { merchantNames });
      return response.data;
    },
  });

  const toggleMerchant = (merchant: string): void => {
    setSelectedMerchants((previous) =>
      previous.includes(merchant) ? previous.filter((value) => value !== merchant) : [...previous, merchant],
    );
  };

  const subscriptions = useMemo<Subscription[]>(
    () => subscriptionsQuery.data?.subscriptions ?? [],
    [subscriptionsQuery.data],
  );

  return (
    <div className="page-grid">
      <SectionCard title="Recurring payments" subtitle="AI-detected subscriptions from transaction patterns">
        {subscriptionsQuery.isLoading ? (
          <LoadingState label="Detecting subscriptions..." />
        ) : subscriptions.length ? (
          <>
            <div className="summary-row">
              <div>
                <strong>{subscriptions.length}</strong>
                <span> subscriptions detected</span>
              </div>
              <div>
                <strong>{formatCurrency(subscriptionsQuery.data?.totals.estimatedMonthlyCost ?? 0)}</strong>
                <span> / month</span>
              </div>
              <div>
                <strong>{formatCurrency(subscriptionsQuery.data?.totals.estimatedYearlyCost ?? 0)}</strong>
                <span> / year</span>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th />
                    <th>Merchant</th>
                    <th>Cadence</th>
                    <th>Avg charge</th>
                    <th>Monthly cost</th>
                    <th>Next expected</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.merchant}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedMerchants.includes(subscription.merchant)}
                          onChange={() => toggleMerchant(subscription.merchant)}
                        />
                      </td>
                      <td>{subscription.merchant}</td>
                      <td>{subscription.cadence}</td>
                      <td>{formatCurrency(subscription.averageAmount)}</td>
                      <td>{formatCurrency(subscription.estimatedMonthlyCost)}</td>
                      <td>{formatDate(subscription.nextExpectedChargeDate)}</td>
                      <td>{Math.round(subscription.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                disabled={!selectedMerchants.length || simulationMutation.isPending}
                onClick={() => simulationMutation.mutate(selectedMerchants)}
              >
                Simulate cancellation
              </button>
              <button type="button" className="secondary-button" onClick={() => setSelectedMerchants([])}>
                Clear selection
              </button>
            </div>
          </>
        ) : (
          <p className="muted-text">No recurring charges detected yet.</p>
        )}
      </SectionCard>

      <SectionCard title="Savings simulation" subtitle="Projected impact if selected subscriptions are cancelled">
        {simulationMutation.data ? (
          <div className="simulation-grid">
            <p>
              <strong>Selected merchants:</strong>{" "}
              {simulationMutation.data.merchants.length
                ? simulationMutation.data.merchants.join(", ")
                : "No matches found"}
            </p>
            <p>
              <strong>Estimated monthly savings:</strong>{" "}
              {formatCurrency(simulationMutation.data.monthlySavings)}
            </p>
            <p>
              <strong>Estimated yearly savings:</strong>{" "}
              {formatCurrency(simulationMutation.data.yearlySavings)}
            </p>
          </div>
        ) : (
          <p className="muted-text">Select subscriptions and run a simulation.</p>
        )}
      </SectionCard>
    </div>
  );
};

