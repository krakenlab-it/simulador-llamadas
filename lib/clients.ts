/**
 * Three fixed client personas. Content lives in the PREFILLED catalog
 * (`lib/scenarios/catalog-presets.ts`) so UI, scoring, and impersonation stay aligned.
 */

import { listCatalogPresets } from "@/lib/scenarios/catalog-presets";

export type ClientBadge = "hard" | "medium";

export interface ClientPersona {
  id: string;
  slug: string;
  name: string;
  title: string;
  company: string;
  difficulty: string;
  badge: ClientBadge;
  indicator: string;
  pains: string[];
  openings: [string, string];
  practiceBrief: string;
}

export const CLIENTS: readonly ClientPersona[] = listCatalogPresets().map(
  (preset) => ({
    id: preset.slug,
    slug: preset.slug,
    name: preset.name,
    title: preset.title,
    company: preset.company,
    difficulty: preset.difficulty,
    badge: preset.badge,
    indicator: preset.indicator,
    pains: [...preset.pains],
    openings: [...preset.openings] as [string, string],
    practiceBrief: preset.practiceBrief,
  }),
);

export function getClientBySlug(slug: string): ClientPersona | undefined {
  return CLIENTS.find((c) => c.slug === slug);
}
