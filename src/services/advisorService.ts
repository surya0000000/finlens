import OpenAI from "openai";

import { env } from "../config/env";
import { round } from "../utils/math";
import { getDashboardSummary } from "./dashboardService";
import { generateInsightsForUser } from "./insightService";
import { detectUserSubscriptions } from "./subscriptionService";

type AdvisorResponse = {
  answer: string;
  citations: string[];
  actions: string[];
  generatedBy: "openai" | "rule-engine";
};

const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

const buildRuleBasedAnswer = (
  question: string,
  context: {
    dashboard: Awaited<ReturnType<typeof getDashboardSummary>>;
    subscriptions: Awaited<ReturnType<typeof detectUserSubscriptions>>;
  },
): AdvisorResponse => {
  const q = question.toLowerCase();
  const { dashboard, subscriptions } = context;

  if (q.includes("subscription")) {
    return {
      answer:
        subscriptions.length > 0
          ? `You have ${subscriptions.length} recurring charges totaling about $${dashboard.subscriptions.estimatedMonthlyTotal}/month. The largest is ${subscriptions[0]?.merchant} at approximately $${subscriptions[0]?.estimatedMonthlyCost}/month.`
          : "No recurring subscriptions were confidently detected in your recent transactions.",
      citations: ["subscriptions.detectedCount", "subscriptions.estimatedMonthlyTotal"],
      actions: [
        "Review the top 3 subscriptions for cancellation opportunities.",
        "Run a cancellation simulation before deciding.",
      ],
      generatedBy: "rule-engine",
    };
  }

  if (q.includes("afford") || q.includes("cash flow") || q.includes("spend")) {
    const buffer = round(dashboard.cashFlow.monthIncome - dashboard.cashFlow.monthSpend, 2);
    return {
      answer: `Your month-to-date net cash flow is $${buffer}. Estimated 30-day outflow at current pace is $${dashboard.cashFlow.projected30dOutflow}. ${
        buffer >= 0
          ? "You currently have a positive margin."
          : "Spending currently exceeds inflows, so caution is recommended."
      }`,
      citations: [
        "cashFlow.monthIncome",
        "cashFlow.monthSpend",
        "cashFlow.projected30dOutflow",
      ],
      actions: [
        "Reduce top discretionary category by 10-15%.",
        "Set a weekly spend cap reminder inside the app.",
      ],
      generatedBy: "rule-engine",
    };
  }

  if (q.includes("credit") || q.includes("card") || q.includes("utilization")) {
    const utilization = dashboard.credit.utilizationPct;
    return {
      answer:
        utilization === null
          ? "No credit utilization data is currently available."
          : `Your current credit utilization is ${utilization}%. ${
              utilization > 30
                ? "Lowering this below 30% is likely beneficial for credit health."
                : "Your utilization is in a generally healthy range."
            }`,
      citations: ["credit.utilizationPct", "credit.revolvingBalance"],
      actions: [
        "Prioritize paying the highest APR card first.",
        "Aim to keep each card below 30% utilization before statement close.",
      ],
      generatedBy: "rule-engine",
    };
  }

  return {
    answer: `Your net worth is about $${dashboard.totals.netWorth}, with month-to-date income of $${dashboard.cashFlow.monthIncome} and spend of $${dashboard.cashFlow.monthSpend}. I can help drill into subscriptions, cash flow, spending trends, or credit optimization.`,
    citations: ["totals.netWorth", "cashFlow.monthIncome", "cashFlow.monthSpend"],
    actions: [
      "Ask: 'What are my largest recurring payments?'",
      "Ask: 'How can I reduce monthly outflow by 10%?'",
    ],
    generatedBy: "rule-engine",
  };
};

const buildContextSummary = (
  dashboard: Awaited<ReturnType<typeof getDashboardSummary>>,
  subscriptions: Awaited<ReturnType<typeof detectUserSubscriptions>>,
  insights: Awaited<ReturnType<typeof generateInsightsForUser>>,
): string => {
  const topCategories = dashboard.topSpendingCategories
    .map((c) => `  - ${c.category}: $${c.amount} (${c.transactionCount} transactions)`)
    .join("\n");

  const topSubs = subscriptions
    .slice(0, 5)
    .map((s) => `  - ${s.merchant}: ~$${s.estimatedMonthlyCost}/month`)
    .join("\n");

  const insightLines = insights
    .slice(0, 4)
    .map((i) => `  - ${i.title}: ${i.message}`)
    .join("\n");

  return `
NET WORTH: $${dashboard.totals.netWorth}
  Assets: $${dashboard.totals.assets} | Liabilities: $${dashboard.totals.liabilities}
  Cash: $${dashboard.totals.cash} | Investments: $${dashboard.totals.investments}

CASH FLOW (this month):
  Income: $${dashboard.cashFlow.monthIncome}
  Spending: $${dashboard.cashFlow.monthSpend}
  Net: $${dashboard.cashFlow.monthNet}
  vs. last month: ${dashboard.cashFlow.spendChangePct !== null ? `${dashboard.cashFlow.spendChangePct > 0 ? "+" : ""}${dashboard.cashFlow.spendChangePct}%` : "no prior data"}
  Projected 30-day outflow: $${dashboard.cashFlow.projected30dOutflow}

TOP SPENDING CATEGORIES:
${topCategories || "  No category data yet."}

CREDIT:
  Utilization: ${dashboard.credit.utilizationPct !== null ? `${dashboard.credit.utilizationPct}%` : "no credit accounts"}
  Revolving balance: $${dashboard.credit.revolvingBalance}

RECURRING SUBSCRIPTIONS (${dashboard.subscriptions.detectedCount} detected, ~$${dashboard.subscriptions.estimatedMonthlyTotal}/month):
${topSubs || "  None detected."}

KEY INSIGHTS:
${insightLines || "  None available."}
`.trim();
};

const tryOpenAiAnswer = async (
  question: string,
  context: {
    dashboard: Awaited<ReturnType<typeof getDashboardSummary>>;
    subscriptions: Awaited<ReturnType<typeof detectUserSubscriptions>>;
    insights: Awaited<ReturnType<typeof generateInsightsForUser>>;
  },
): Promise<AdvisorResponse | null> => {
  if (!openaiClient) {
    return null;
  }

  const systemPrompt = `You are a sharp, friendly personal finance advisor embedded in the FinLens app. The user has connected their real bank accounts and you have access to their actual financial data below.

Your job is to directly answer whatever the user asks using their data. Be conversational and specific — use their real numbers, not generic advice. If the data is relevant to their question, reference it. If it isn't, just answer honestly.

Guidelines:
- Answer the specific question asked, not a generic version of it
- Use the user's actual numbers when they're relevant
- Be concise but complete — 2-4 sentences is usually right
- Suggest 1-2 concrete next steps when helpful
- Never make up data that isn't in the context
- Don't give tax, legal, or investment advice
- Don't start your answer with "Based on your data" or "According to your finances" — just answer directly

Respond with JSON: { "answer": string, "citations": string[], "actions": string[] }
- answer: your natural conversational response
- citations: short labels for data points you referenced (e.g. "cashFlow.monthNet", "credit.utilizationPct") — empty array if none
- actions: 0-2 concrete suggested next steps as short imperative strings — empty array if none fit`;

  const userMessage = `USER'S FINANCIAL DATA:
${buildContextSummary(context.dashboard, context.subscriptions, context.insights)}

USER'S QUESTION: ${question}`;

  const completion = await openaiClient.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as {
    answer?: string;
    citations?: string[];
    actions?: string[];
  };

  if (!parsed.answer) {
    return null;
  }

  return {
    answer: parsed.answer,
    citations: Array.isArray(parsed.citations) ? parsed.citations.slice(0, 6) : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
    generatedBy: "openai",
  };
};

export const answerAdvisorQuestion = async (
  userId: string,
  question: string,
): Promise<AdvisorResponse> => {
  const [dashboard, subscriptions, insights] = await Promise.all([
    getDashboardSummary(userId),
    detectUserSubscriptions(userId),
    generateInsightsForUser(userId),
  ]);

  try {
    const openAiResponse = await tryOpenAiAnswer(question, {
      dashboard,
      subscriptions: subscriptions.slice(0, 8),
      insights,
    });

    if (openAiResponse) {
      return openAiResponse;
    }
  } catch (err) {
    console.error("[advisorService] OpenAI call failed, falling back to rule engine:", err);
  }

  return buildRuleBasedAnswer(question, {
    dashboard,
    subscriptions,
  });
};

export type { AdvisorResponse };

