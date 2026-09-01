export interface SignUpFields {
  email: string;
  password: string;
  confirmPassword: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "El correo electrónico es obligatorio.";
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Introduce un correo electrónico válido.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "La contraseña es obligatoria.";
  if (password.length < 6) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  return null;
}

export function validateSignIn(email: string, password: string): string | null {
  return validateEmail(email) ?? validatePassword(password);
}

export function validateSignUp(fields: SignUpFields): string | null {
  const emailError = validateEmail(fields.email);
  if (emailError) return emailError;

  const passwordError = validatePassword(fields.password);
  if (passwordError) return passwordError;

  if (fields.password !== fields.confirmPassword) {
    return "Las contraseñas no coinciden.";
  }

  return null;
}

/** Where the UI should go after a successful auth action. */
export type PostAuthTarget = "dashboard" | "voice";

export function resolvePostAuthTarget(
  authenticated: boolean,
  target: PostAuthTarget = "dashboard",
): PostAuthTarget | null {
  return authenticated ? target : null;
}
