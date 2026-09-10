interface HappyFaceIconProps {
  size?: number;
  className?: string;
}

export function HappyFaceIcon({ size = 28, className }: HappyFaceIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="8" fill="currentColor" opacity="0.12" />
      <circle cx="14" cy="14" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10.75" cy="12.25" r="1.15" fill="currentColor" />
      <circle cx="17.25" cy="12.25" r="1.15" fill="currentColor" />
      <path
        d="M10.5 16.25c1.1 1.65 2.55 2.45 3.5 2.45s2.4-.8 3.5-2.45"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
