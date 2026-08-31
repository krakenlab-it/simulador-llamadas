"use client";

import { useState } from "react";

/**
 * Brand mark: uses `public/brand/cdc-mark-light.jpg` when present.
 * Falls back to an inline SVG in brand colors.
 */
export function BrandMark() {
  const [showImage, setShowImage] = useState(true);

  return (
    <div className="brand-mark" aria-hidden="true">
      {showImage ? (
        // Optional local asset; falls back to SVG when cdc-mark-light.jpg is absent.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/cdc-mark-light.jpg"
          alt=""
          width={36}
          height={36}
          className="brand-mark-image"
          onError={() => setShowImage(false)}
        />
      ) : (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="32" height="32" rx="8" fill="#EEF1EE" />
          <path
            d="M8 22V10h3.2l4.1 7.2V10H16v12h-3.1l-4.2-7.4V22H8z"
            fill="#0E1A2B"
          />
          <path
            d="M17.5 22l2.8-12H24l2.8 12h-2.9l-.5-2.4h-3.4l-.5 2.4h-2.9zm4.4-4.8l-1.2-5.6-1.2 5.6h2.4z"
            fill="#00A08A"
          />
          <circle cx="26" cy="8" r="3" fill="#FF5A1F" />
        </svg>
      )}
    </div>
  );
}
