import type { ReactNode } from "react";

interface ScreenTransitionProps {
  screenKey: string;
  children: ReactNode;
}

export function ScreenTransition({ screenKey, children }: ScreenTransitionProps) {
  return (
    <div key={screenKey} className="screen-transition" data-screen={screenKey}>
      {children}
    </div>
  );
}
