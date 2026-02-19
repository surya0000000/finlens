import dayjs from "dayjs";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LockKeyhole, RefreshCw, Shield } from "lucide-react";

import { LoadingState } from "../components/LoadingState";
import { PlaidConnectCard } from "../components/PlaidConnectCard";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import type { Account, PlaidItem, TransactionsResponse } from "../types/api";

export const AccountsPage = () => {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const response = await api.get<{ accounts: Account[] }>("/finance/accounts");
      return response.data.accounts;
    },
  });

  const plaidItemsQuery = useQuery({
    queryKey: ["plaid-items"],
    queryFn: async () => {
      const response = await api.get<{ items: PlaidItem[] }>("/plaid/items");
      return response.data.items;
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", "accounts-page", selectedAccountId],
    queryFn: async () => {
      const response = await api.get<TransactionsResponse>("/finance/transactions", {
        params: {
          page: 1,
          pageSize: 30,
          accountId: selectedAccountId || undefined,
        },
      });
      return response.data;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      await api.post("/plaid/sync", {});
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["plaid-items"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    },
  });

  const isLoading = accountsQuery.isLoading || plaidItemsQuery.isLoading || transactionsQuery.isLoading;

  if (isLoading) {
    return <LoadingState label="Loading accounts and integrations..." />;
  }

  const accounts = accountsQuery.data ?? [];
  const items = plaidItemsQuery.data ?? [];
  const transactions = transactionsQuery.data?.transactions ?? [];

  return (
    <div className="accounts-layout">
      <section className="panel integration-panel">
        <header className="panel-header">
          <div>
            <h3>Connected Institutions</h3>
            <p>Secure, read-only connections across your financial providers.</p>
          </div>
          <button
            type="button"
            className="action-button subtle"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw size={14} />
            Sync now
          </button>
        </header>

        {items.length ? (
          <div className="institution-grid">
            {items.map((item) => {
              const syncedRecently =
                item.lastSyncedAt !== null &&
                dayjs().diff(dayjs(item.lastSyncedAt), "minute") <= 30;
              return (
                <article key={item.id} className="institution-card">
                  <div>
                    <h4>{item.institutionName ?? "Connected Institution"}</h4>
                    <p>{item.institutionId ?? "Institution ID unavailable"}</p>
                  </div>
                  <div className="institution-meta">
                    <span className={`status-pill ${syncedRecently ? "ok" : "stale"}`}>
                      {syncedRecently ? "Synced" : "Pending sync"}
                    </span>
                    <small>
                      Last sync: {item.lastSyncedAt ? formatDate(item.lastSyncedAt) : "Not synced yet"}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted-text">No institutions connected yet. Add your first account below.</p>
        )}

        <PlaidConnectCard
          onLinked={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["accounts"] }),
              queryClient.invalidateQueries({ queryKey: ["plaid-items"] }),
              queryClient.invalidateQueries({ queryKey: ["transactions"] }),
            ]);
          }}
        />
      </section>

      <section className="panel security-panel">
        <header className="panel-header">
          <div>
            <h3>Security Architecture</h3>
            <p>Subtle by design, strict in implementation.</p>
          </div>
        </header>
        <ul className="security-list">
          <li>
            <Shield size={14} />
            End-to-end encryption in transit and at rest.
          </li>
          <li>
            <LockKeyhole size={14} />
            Read-only data connections. No payment execution.
          </li>
          <li>
            <CheckCircle2 size={14} />
            Bank-grade provider integrations and scoped access.
          </li>
        </ul>
      </section>

      <section className="panel account-table-panel">
        <header className="panel-header">
          <div>
            <h3>Account Ledger</h3>
            <p>Bank accounts, investments, retirement funds, credit, and loans.</p>
          </div>
          <div className="table-filter">
            <label htmlFor="accountFilter">Account</label>
            <select
              id="accountFilter"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.mask ?? "n/a"})
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Mask</th>
                <th>Current balance</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
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
      </section>

      <section className="panel transactions-panel">
        <header className="panel-header">
          <div>
            <h3>Recent Transactions</h3>
            <p>Latest activity from selected account scope.</p>
          </div>
        </header>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Account</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
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
      </section>
    </div>
  );
};

