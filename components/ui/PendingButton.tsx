import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface PendingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean;
  pendingLabel?: string;
  children: ReactNode;
  variant?: "default" | "primary";
}

export function PendingButton({
  pending = false,
  pendingLabel,
  children,
  variant = "default",
  disabled,
  className = "",
  ...props
}: PendingButtonProps) {
  const isDisabled = disabled || pending;
  const label = pending && pendingLabel ? pendingLabel : children;

  return (
    <button
      type="button"
      className={`${variant === "primary" ? "primary " : ""}${className}`.trim()}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <Spinner size="sm" />}
      <span className={pending ? "btn-label-pending" : undefined}>{label}</span>
    </button>
  );
}
