import { X, SendHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, extractApiError } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { AdvisorResponse, DashboardResponse } from "../types/api";

type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: string[];
  actions?: string[];
};

type AICopilotPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

const tooltipFormatter = (value: unknown): string => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return formatCurrency(Number.isFinite(numericValue) ? numericValue : 0);
};

export const AICopilotPanel = ({ isOpen, onClose }: AICopilotPanelProps) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Ask FinLens when you need analysis. I remain quiet unless requested.",
    },
  ]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await api.get<DashboardResponse>("/finance/dashboard");
      return response.data;
    },
    enabled: isOpen,
  });

  const advisorMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await api.post<AdvisorResponse>("/advisor/query", { question });
      return response.data;
    },
    onSuccess: (result, question) => {
      setError(null);
      setMessages((previous) => [
        ...previous,
        { id: `${Date.now()}-user`, role: "user", text: question },
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: result.answer,
          citations: result.citations,
          actions: result.actions,
        },
      ]);
    },
    onError: (mutationError) => {
      setError(extractApiError(mutationError));
    },
  });

  const suggestions = useMemo(
    () => [
      "Why did my net worth drop in March?",
      "Can I afford a $3,000 vacation next month?",
      "How exposed am I to tech stocks?",
      "Optimize my subscriptions.",
    ],
    [],
  );

  const submitPrompt = async (question: string): Promise<void> => {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    setInput("");
    await advisorMutation.mutateAsync(trimmed);
  };

  return (
    <>
      <div className={`copilot-overlay ${isOpen ? "open" : ""}`} onClick={onClose} aria-hidden={!isOpen} />
      <aside className={`copilot-panel ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <header className="copilot-header">
          <div>
            <h3>FinLens AI Co-Pilot</h3>
            <p>On-demand financial reasoning. No interruptions.</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} aria-label="Close AI panel">
            <X size={16} />
          </button>
        </header>

        <div className="copilot-content">
          <div className="copilot-suggestions">
            {suggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="suggestion-chip"
                onClick={async () => submitPrompt(prompt)}
                disabled={advisorMutation.isPending}
              >
                {prompt}
              </button>
            ))}
          </div>

          <section className="copilot-viz">
            <h4>Supporting view</h4>
            <p>Current top spending categories.</p>
            <div className="copilot-mini-chart">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={dashboardQuery.data?.topSpendingCategories.slice(0, 5) ?? []}>
                  <XAxis dataKey="category" hide />
                  <YAxis hide />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="amount" radius={[5, 5, 0, 0]} fill="#5168f4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="copilot-thread">
            {messages.map((message) => (
              <article key={message.id} className={`copilot-message ${message.role}`}>
                <p>{message.text}</p>
                {message.citations?.length ? (
                  <small>Citations: {message.citations.join(", ")}</small>
                ) : null}
                {message.actions?.length ? (
                  <div className="copilot-actions">
                    {message.actions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="ghost-chip"
                        onClick={() => setInput(action)}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <form
          className="copilot-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await submitPrompt(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about trends, affordability, risk, or subscriptions"
            disabled={advisorMutation.isPending}
          />
          <button type="submit" className="copilot-send" disabled={!input.trim() || advisorMutation.isPending}>
            <SendHorizontal size={14} />
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
      </aside>
    </>
  );
};

