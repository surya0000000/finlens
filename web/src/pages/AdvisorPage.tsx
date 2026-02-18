import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { SectionCard } from "../components/SectionCard";
import { api, extractApiError } from "../lib/api";
import type { AdvisorResponse } from "../types/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: {
    citations?: string[];
    actions?: string[];
    source?: string;
  };
};

export const AdvisorPage = (): JSX.Element => {
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me about cash flow, subscriptions, spending trends, or credit utilization. I will use your latest synced data.",
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  const advisorMutation = useMutation({
    mutationFn: async (nextQuestion: string) => {
      const response = await api.post<AdvisorResponse>("/advisor/query", {
        question: nextQuestion,
      });
      return response.data;
    },
    onSuccess: (response, askedQuestion) => {
      setError(null);
      setChat((previous) => [
        ...previous,
        { id: `${Date.now()}-u`, role: "user", content: askedQuestion },
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          content: response.answer,
          meta: {
            citations: response.citations,
            actions: response.actions,
            source: response.generatedBy,
          },
        },
      ]);
    },
    onError: (mutationError) => {
      setError(extractApiError(mutationError));
    },
  });

  const examplePrompts = useMemo(
    () => [
      "What are my recurring payments this month?",
      "Can I reduce my monthly spend by 10%?",
      "How is my credit utilization right now?",
      "Do I have positive cash flow this month?",
    ],
    [],
  );

  const submitQuestion = async (nextQuestion: string): Promise<void> => {
    if (!nextQuestion.trim()) {
      return;
    }

    const cleanQuestion = nextQuestion.trim();
    setQuestion("");
    await advisorMutation.mutateAsync(cleanQuestion);
  };

  return (
    <div className="page-grid">
      <SectionCard title="FinLens Advisor" subtitle="Ask natural-language questions about your finances">
        <div className="chat-panel">
          {chat.map((message) => (
            <article key={message.id} className={`chat-message ${message.role}`}>
              <p>{message.content}</p>
              {message.meta ? (
                <small>
                  Source: {message.meta.source}
                  {message.meta.citations?.length ? ` • Citations: ${message.meta.citations.join(", ")}` : ""}
                  {message.meta.actions?.length
                    ? ` • Suggested actions: ${message.meta.actions.join(" | ")}`
                    : ""}
                </small>
              ) : null}
            </article>
          ))}
        </div>

        <form
          className="advisor-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await submitQuestion(question);
          }}
        >
          <input
            placeholder="Ask: Can I afford to pay my card in full this month?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={advisorMutation.isPending}
          />
          <button type="submit" className="primary-button" disabled={advisorMutation.isPending || !question.trim()}>
            {advisorMutation.isPending ? "Thinking..." : "Ask Advisor"}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
      </SectionCard>

      <SectionCard title="Quick prompts" subtitle="Start with a guided question">
        <div className="prompt-grid">
          {examplePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="secondary-button prompt-button"
              disabled={advisorMutation.isPending}
              onClick={async () => submitQuestion(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

