import type { ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const hasPrimary = Boolean(actionLabel && onAction);
  const hasSecondary = Boolean(secondaryActionLabel && onSecondaryAction);
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state__icon" aria-hidden="true">{icon}</div> : null}
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__desc">{description}</p>
      {hasPrimary || hasSecondary ? (
        <div className="empty-state__actions">
          {hasPrimary ? (
            <Button variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
          {hasSecondary ? (
            <Button variant="secondary" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
