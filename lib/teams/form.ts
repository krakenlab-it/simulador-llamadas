export function teamScoreError(value: number): string | null {
  if (!Number.isFinite(value)) {
    return "El puntaje tiene que ser un número entre 0 y 100.";
  }
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) {
    return "El puntaje tiene que ser un número entre 0 y 100.";
  }
  return null;
}

export function teamNameError(name: string): string | null {
  if (!name.trim()) return "Escribe el nombre del equipo.";
  return null;
}

export function memberNameError(name: string): string | null {
  if (!name.trim()) return "Escribe el nombre de la persona.";
  return null;
}

export function memberEmailError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Revisa el correo. Ejemplo: jaime@equipo.com";
  }
  return null;
}

export function isDuplicateMember(
  name: string,
  existing: readonly { displayName: string }[],
): boolean {
  const key = name.trim().toLowerCase();
  if (!key) return false;
  return existing.some((member) => member.displayName.trim().toLowerCase() === key);
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
