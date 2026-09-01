import type { KeyboardEvent, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  selected?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  tabIndex?: number;
  role?: string;
  "aria-pressed"?: boolean;
}

export function Card({
  children,
  selected = false,
  interactive = false,
  className = "",
  ...props
}: CardProps) {
  const classes = [
    "card",
    interactive ? "card--interactive" : "",
    selected ? "card--selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes} {...props}>
      {children}
    </article>
  );
}
