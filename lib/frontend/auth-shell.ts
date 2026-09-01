/**
 * Shell user model for the logged-in trainee UI.
 */

export interface ShellUser {
  id: string;
  displayName: string;
  email: string;
  initials: string;
}

export function sessionToShellUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string; name?: string };
}): ShellUser {
  const email = user.email ?? "";
  const metaName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
  const displayName =
    metaName.trim() ||
    (email.includes("@") ? email.split("@")[0] : "Usuario");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return {
    id: user.id,
    displayName,
    email,
    initials: initials || "U",
  };
}
