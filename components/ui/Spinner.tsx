interface SpinnerProps {
  size?: "sm" | "md";
  label?: string;
}

export function Spinner({ size = "md", label }: SpinnerProps) {
  return (
    <span
      className={`spinner spinner-${size}`}
      role="status"
      aria-label={label ?? "Cargando"}
      aria-live="polite"
    />
  );
}
