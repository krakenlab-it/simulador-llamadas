"use client";

import { useId, useState, type FocusEvent } from "react";

export const STEP_NAV_EMPTY_SUMMARY = "Aún sin completar";

interface StepNavPopoverProps {
  stepNumber: number;
  label: string;
  summary: string;
  hint?: string;
  isActive?: boolean;
  isDone?: boolean;
  onSelect: () => void;
  variant: "wizard" | "builder";
}

export function StepNavPopover({
  stepNumber,
  label,
  summary,
  hint,
  isActive = false,
  isDone = false,
  onSelect,
  variant,
}: StepNavPopoverProps) {
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const trimmedSummary = summary.trim();
  const isEmpty = trimmedSummary.length === 0;
  const displaySummary = isEmpty ? STEP_NAV_EMPTY_SUMMARY : trimmedSummary;

  const handleBlur = (event: FocusEvent<HTMLLIElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  if (variant === "builder") {
    return (
      <li
        className={`builder-steps__item builder-steps__item--${isActive ? "current" : isDone ? "done" : "pending"} step-nav-popover-host`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
      >
        <button
          type="button"
          className="builder-steps__button"
          aria-current={isActive ? "step" : undefined}
          aria-describedby={popoverId}
          onClick={onSelect}
        >
          <span className="builder-steps__index">{stepNumber}</span>
          <span className="builder-steps__copy">
            <strong>{label}</strong>
            <span>{hint ?? STEP_NAV_EMPTY_SUMMARY}</span>
          </span>
        </button>
        <div
          id={popoverId}
          role="tooltip"
          className={`step-nav-popover step-nav-popover--builder ${open ? "step-nav-popover--open" : ""} ${isEmpty ? "step-nav-popover--empty" : ""}`}
        >
          <p className="step-nav-popover__title">{label}</p>
          <p className="step-nav-popover__body">{displaySummary}</p>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`wizard-steps__item ${isActive ? "wizard-steps__item--active" : ""} ${isDone ? "wizard-steps__item--done" : ""} step-nav-popover-host`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={handleBlur}
    >
      <button
        type="button"
        className="wizard-steps__button"
        aria-current={isActive ? "step" : undefined}
        aria-describedby={popoverId}
        onClick={onSelect}
      >
        {stepNumber}. {label}
      </button>
      <div
        id={popoverId}
        role="tooltip"
        className={`step-nav-popover step-nav-popover--wizard ${open ? "step-nav-popover--open" : ""} ${isEmpty ? "step-nav-popover--empty" : ""}`}
      >
        <p className="step-nav-popover__title">{label}</p>
        <p className="step-nav-popover__body">{displaySummary}</p>
      </div>
    </li>
  );
}
