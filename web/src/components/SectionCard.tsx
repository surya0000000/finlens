import type { PropsWithChildren, ReactNode } from "react";

type SectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
}>;

export const SectionCard = ({ title, subtitle, action, children }: SectionCardProps) => (
  <section className="card section-card">
    <header className="section-header">
      <div>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
    {children}
  </section>
);

