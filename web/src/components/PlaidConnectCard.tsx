import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useMutation } from "@tanstack/react-query";

import { api, extractApiError } from "../lib/api";

type PlaidConnectCardProps = {
  onLinked: () => Promise<void> | void;
};

type LinkTokenResponse = {
  linkToken: string;
};

type ExchangeResponse = {
  itemId: string;
  plaidItemId: string;
};

export const PlaidConnectCard = ({ onLinked }: PlaidConnectCardProps) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exchangeMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      await api.post<ExchangeResponse>("/plaid/exchange-public-token", {
        publicToken,
      });
    },
    onSuccess: async () => {
      setError(null);
      await onLinked();
    },
    onError: (mutationError) => {
      setError(extractApiError(mutationError));
    },
  });

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      await exchangeMutation.mutateAsync(publicToken);
    },
    onExit: (exitError) => {
      if (exitError?.display_message) {
        setError(exitError.display_message);
      }
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const createLinkTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<LinkTokenResponse>("/plaid/link-token");
      return response.data.linkToken;
    },
    onSuccess: (token) => {
      setError(null);
      setLinkToken(token);
    },
    onError: (mutationError) => {
      setError(extractApiError(mutationError));
    },
  });

  const sandboxConnectMutation = useMutation({
    mutationFn: async () => {
      const publicTokenResponse = await api.post<{ publicToken: string }>(
        "/plaid/sandbox/public-token",
        {},
      );

      await exchangeMutation.mutateAsync(publicTokenResponse.data.publicToken);
    },
    onError: (mutationError) => {
      setError(extractApiError(mutationError));
    },
  });

  const isLoading =
    createLinkTokenMutation.isPending || sandboxConnectMutation.isPending || exchangeMutation.isPending;

  return (
    <section className="card plaid-card">
      <header className="section-header">
        <div>
          <h3>Connect your accounts</h3>
          <p>Use Plaid Link for secure read-only bank and card sync.</p>
        </div>
      </header>

      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          disabled={isLoading}
          onClick={() => createLinkTokenMutation.mutate()}
        >
          <Link2 size={16} />
          Connect with Plaid
        </button>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={() => sandboxConnectMutation.mutate()}
        >
          Quick sandbox connect
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
};

