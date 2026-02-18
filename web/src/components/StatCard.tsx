import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
  hint?: string;
  icon?: ReactNode;
};

export const StatCard = ({ label, value, tone = "neutral", hint, icon }: StatCardProps) => (
  <article className={`card stat-card tone-${tone}`}>
    <div className="stat-card-row">
      <span className="stat-label">{label}</span>
      {icon}
    </div>
    <p className="stat-value">{value}</p>
    {hint ? <p className="stat-hint">{hint}</p> : null}
  </article>
);

