import type { ReactNode } from "react";
import { Info } from "lucide-react";
export function Badge({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Panel({
  title,
  subtitle,
  extra,
  children,
  className = "",
  id,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
export function Insight({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`insight ${warning ? "insight-warning" : ""}`}>
      <Info size={14} />
      <span>{children}</span>
    </div>
  );
}
