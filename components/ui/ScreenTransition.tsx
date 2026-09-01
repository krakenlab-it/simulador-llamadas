"use client";

import { useEffect, useState, type ReactNode } from "react";

interface ScreenTransitionProps {
  screenKey: string;
  children: ReactNode;
}

export function ScreenTransition({ screenKey, children }: ScreenTransitionProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [screenKey]);

  return (
    <div
      className={`screen-transition ${visible ? "screen-transition-visible" : ""}`}
      key={screenKey}
    >
      {children}
    </div>
  );
}
