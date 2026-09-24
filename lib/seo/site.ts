export const SITE_NAME = "Simulador de Llamadas";
export const SITE_TAGLINE = "Entrenamiento comercial con IA";
export const SITE_DESCRIPTION =
  "Practica llamadas de venta con clientes simulados, recibe feedback al instante y mejora tu cierre antes de marcar de verdad.";

const FALLBACK_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  try {
    return new URL(raw || FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export const PUBLIC_ROBOTS = {
  index: true,
  follow: true,
} as const;

export const APP_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
} as const;

export function buildRobots() {
  const origin = getSiteUrl().origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/api/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}

export function buildSitemap() {
  const origin = getSiteUrl().origin;
  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
  ];
}
