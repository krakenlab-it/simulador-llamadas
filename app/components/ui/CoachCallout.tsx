import type { ReactNode } from "react";

type CoachCalloutTone = "info" | "success" | "warn";

interface CoachCalloutProps {
  title: string;
  children: ReactNode;
  tone?: CoachCalloutTone;
  className?: string;
}

export function CoachCallout({
  title,
  children,
  tone = "info",
  className = "",
}: CoachCalloutProps) {
  return (
    <aside
      className={`coach-callout coach-callout--${tone} ${className}`.trim()}
      role="note"
    >
      <p className="coach-callout__title">{title}</p>
      <div className="coach-callout__body">{children}</div>
    </aside>
  );
}
