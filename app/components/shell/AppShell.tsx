import type { ReactNode } from "react";
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
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="currentColor" opacity="0.12" />
              <path
                d="M8 11.5c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v5c0 1.1-.9 2-2 2h-3.2l-2.3 2.3c-.4.4-1 .1-1-.4V18.5H10c-1.1 0-2-.9-2-2v-5z"
                fill="currentColor"
              />
            </svg>
          </span>
          <div>
            <p className="app-header__title">Simulador de Llamadas</p>
            <p className="app-header__tagline">Entrenamiento comercial con IA</p>
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
