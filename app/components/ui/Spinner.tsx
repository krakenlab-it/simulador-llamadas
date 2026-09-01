interface SpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ label = "Cargando…", size = "md" }: SpinnerProps) {
  return (
    <div
      className={`spinner spinner--${size}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="spinner__ring" aria-hidden="true" />
      <span className="spinner__text">{label}</span>
    </div>
  );
}
