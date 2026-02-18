import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { LoadingState } from "../components/LoadingState";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import type { Account, TransactionsResponse } from "../types/api";

const pageSize = 25;

export const AccountsPage = () => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await api.get<{ accounts: Account[] }>("/finance/accounts");
      return response.data.accounts;
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", selectedAccountId, page],
    queryFn: async () => {
      const response = await api.get<TransactionsResponse>("/finance/transactions", {
        params: {
          page,
          pageSize,
          accountId: selectedAccountId || undefined,
        },
      });
      return response.data;
    },
  });

  return (
    <div className="page-grid">
      <SectionCard title="Linked accounts" subtitle="Balances synced from Plaid integrations">
        {accountsQuery.isLoading ? (
          <LoadingState label="Loading accounts..." />
        ) : accountsQuery.data?.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Mask</th>
                  <th>Current balance</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {accountsQuery.data.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>
                      {account.type}
                      {account.subtype ? ` / ${account.subtype}` : ""}
                    </td>
                    <td>{account.mask ?? "—"}</td>
                    <td>{formatCurrency(account.currentBalance)}</td>
                    <td>{account.availableBalance === null ? "—" : formatCurrency(account.availableBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-text">No accounts linked yet.</p>
        )}
      </SectionCard>

      <SectionCard title="Transactions" subtitle="Recent activity across connected accounts">
        <div className="filters">
          <label htmlFor="accountFilter">Filter by account</label>
          <select
            id="accountFilter"
            value={selectedAccountId}
            onChange={(event) => {
              setSelectedAccountId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All accounts</option>
            {accountsQuery.data?.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.mask ?? "n/a"})
              </option>
            ))}
          </select>
        </div>

        {transactionsQuery.isLoading ? (
          <LoadingState label="Loading transactions..." />
        ) : transactionsQuery.data?.transactions.length ? (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsQuery.data.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.date)}</td>
                      <td>{transaction.merchantName ?? transaction.name}</td>
                      <td>{transaction.accountName}</td>
                      <td>{transaction.primaryCategory ?? "OTHER"}</td>
                      <td className={transaction.amount > 0 ? "negative-value" : "positive-value"}>
                        {formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                type="button"
                className="secondary-button"
                disabled={page <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.max(1, Math.ceil((transactionsQuery.data.totalCount || 1) / pageSize))}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={page * pageSize >= transactionsQuery.data.totalCount}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="muted-text">No transactions available for this filter.</p>
        )}
      </SectionCard>
    </div>
  );
};

