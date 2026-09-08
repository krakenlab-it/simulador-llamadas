import type { ReactNode } from "react";
import { HappyFaceIcon } from "@/components/brand/HappyFaceIcon";
import { APP_BRAND_NAME, APP_TAGLINE } from "@/lib/brand/content";
import type { ShellUser } from "@/lib/frontend/auth-shell";

export type ShellTab = "home" | "train";

interface AppShellProps {
  user: ShellUser;
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  onSignOut?: () => void;
  children: ReactNode;
  /** Hide nav during an active call */
  compact?: boolean;
}

export function AppShell({
  user,
  activeTab,
  onTabChange,
  onSignOut,
  children,
  compact = false,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
            <HappyFaceIcon size={28} />
          </span>
          <div>
            <p className="app-header__title">{APP_BRAND_NAME}</p>
            <p className="app-header__tagline">{APP_TAGLINE}</p>
          </div>
        </div>

        {!compact ? (
          <nav className="app-nav" aria-label="Navegación principal">
            <button
              type="button"
              className={`app-nav__tab ${activeTab === "home" ? "app-nav__tab--active" : ""}`}
              onClick={() => onTabChange("home")}
              aria-current={activeTab === "home" ? "page" : undefined}
            >
              Inicio
            </button>
            <button
              type="button"
              className={`app-nav__tab ${activeTab === "train" ? "app-nav__tab--active" : ""}`}
              onClick={() => onTabChange("train")}
              aria-current={activeTab === "train" ? "page" : undefined}
            >
              Entrenar
            </button>
          </nav>
        ) : null}

        <div className="app-header__user" title={user.email}>
          <span className="app-header__avatar" aria-hidden="true">
            {user.initials}
          </span>
          <span className="app-header__name">{user.displayName}</span>
          {onSignOut ? (
            <button
              type="button"
              className="app-header__signout"
              onClick={onSignOut}
            >
              Salir
            </button>
          ) : null}
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
