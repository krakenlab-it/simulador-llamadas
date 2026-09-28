import type { ProductRole } from "@/lib/frontend/product-role";
import type { AppView } from "@/lib/frontend/flow";

/** Top-level shell tabs (role-aware). */
export type ShellTab = "home" | "train" | "ia" | "agents" | "grades";

export interface ShellNavItem {
  tab: ShellTab;
  label: string;
}

export function shellNavForRole(role: ProductRole): ShellNavItem[] {
  if (role === "capacitador") {
    return [
      { tab: "home", label: "Inicio" },
      { tab: "train", label: "Escenarios" },
      { tab: "ia", label: "IA" },
      { tab: "agents", label: "Agentes" },
      { tab: "grades", label: "Calificaciones" },
    ];
  }
  return [
    { tab: "home", label: "Inicio" },
    { tab: "train", label: "Practicar" },
    { tab: "grades", label: "Mis resultados" },
  ];
}

export function shellTabFromView(view: AppView): ShellTab {
  switch (view) {
    case "home":
    case "history":
    case "detail":
    case "results":
      return "home";
    case "train":
    case "builder":
    case "call":
      return "train";
    case "agent":
      return "ia";
    case "teams":
      return "agents";
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export function viewForShellTab(tab: ShellTab): AppView {
  switch (tab) {
    case "home":
      return "home";
    case "train":
      return "train";
    case "ia":
      return "agent";
    case "agents":
      return "teams";
    case "grades":
      return "history";
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

export function canAccessView(role: ProductRole, view: AppView): boolean {
  if (role === "capacitador") return true;
  if (view === "builder" || view === "agent" || view === "teams") return false;
  return true;
}

export function resolveShellTabForView(
  view: AppView,
  role: ProductRole,
): ShellTab {
  if (view === "history") return "grades";
  if (view === "detail" || view === "results") {
    return role === "agente" ? "grades" : "home";
  }
  return shellTabFromView(view);
}
