import type { ReactNode } from "react";
import type { ShellUser } from "@/lib/frontend/auth-shell";
import {
  shellNavForRole,
  type ShellTab,
} from "@/lib/frontend/role-navigation";
import {
  productRoleLabel,
  type ProductRole,
} from "@/lib/frontend/product-role";

export type { ShellTab };

interface AppShellProps {
  user: ShellUser;
  productRole: ProductRole;
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  onSignOut?: () => void;
  onChangeRole?: () => void;
  children: ReactNode;
  /** Hide nav during an active call */
  compact?: boolean;
}

export function AppShell({
  user,
  productRole,
  activeTab,
  onTabChange,
  onSignOut,
  onChangeRole,
  children,
  compact = false,
}: AppShellProps) {
  const navItems = shellNavForRole(productRole);

  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
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
            <p className="app-header__tagline">
              {productRoleLabel(productRole)} · entrenamiento con IA
            </p>
          </div>
        </div>

        {!compact ? (
          <nav className="app-nav" aria-label="Navegación principal">
            {navItems.map((item) => (
              <button
                key={item.tab}
                type="button"
                className={`app-nav__tab ${activeTab === item.tab ? "app-nav__tab--active" : ""}`}
                onClick={() => onTabChange(item.tab)}
                aria-current={activeTab === item.tab ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="app-header__user" title={user.email}>
          <span className="app-header__avatar" aria-hidden="true">
            {user.initials}
          </span>
          <span className="app-header__name">{user.displayName}</span>
          {onChangeRole ? (
            <button type="button" className="app-header__signout" onClick={onChangeRole}>
              Cambiar rol
            </button>
          ) : null}
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

      <main id="contenido" className="app-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
