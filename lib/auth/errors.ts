/** Map Supabase Auth errors to Spanish messages for the UI. */
export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (normalized.includes("user already registered")) {
    return "Ya existe una cuenta con este correo. Inicia sesión.";
  }
  if (normalized.includes("email not confirmed")) {
    return "La cuenta requiere confirmación por correo. Pide al administrador desactivar la confirmación de email en Supabase.";
  }
  if (normalized.includes("password")) {
    return "La contraseña no cumple los requisitos mínimos.";
  }
  if (normalized.includes("rate limit")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }

  return "No se pudo completar la autenticación. Inténtalo de nuevo.";
}
