/**
 * Human product roles (Capacitador vs Agente). Distinct from the conversational «IA» surface.
 * Persisted in localStorage until production auth assigns roles server-side.
 */

export type ProductRole = "capacitador" | "agente";

const STORAGE_KEY = "simulador.productRole";

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readProductRole(storage?: Storage): ProductRole | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  const raw = store.getItem(STORAGE_KEY);
  if (raw === "capacitador" || raw === "agente") return raw;
  return null;
}

export function writeProductRole(role: ProductRole, storage?: Storage): void {
  const store = resolveStorage(storage);
  if (!store) return;
  store.setItem(STORAGE_KEY, role);
}

export function clearProductRole(storage?: Storage): void {
  const store = resolveStorage(storage);
  if (!store) return;
  store.removeItem(STORAGE_KEY);
}

export function productRoleLabel(role: ProductRole): string {
  return role === "capacitador" ? "Capacitador" : "Agente";
}
