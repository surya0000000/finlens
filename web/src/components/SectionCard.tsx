import type { PropsWithChildren } from "react";

type SectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: JSX.Element;
}>;

export const SectionCard = ({ title, subtitle, action, children }: SectionCardProps): JSX.Element => (
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

