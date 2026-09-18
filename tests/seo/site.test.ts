import { describe, expect, it } from "vitest";
import {
  APP_ROBOTS,
  PUBLIC_ROBOTS,
  SITE_DESCRIPTION,
  SITE_NAME,
  buildRobots,
  buildSitemap,
  getSiteUrl,
} from "@/lib/seo/site";

describe("public SEO helpers", () => {
  it("indexes the marketing site and noindexes the authenticated app", () => {
    expect(PUBLIC_ROBOTS.index).toBe(true);
    expect(APP_ROBOTS.index).toBe(false);
    expect(SITE_NAME).toMatch(/Simulador/);
    expect(SITE_DESCRIPTION.length).toBeGreaterThan(40);
  });

  it("keeps robots friendly for / and blocks /app plus APIs", () => {
    const robots = buildRobots();
    expect(robots.rules[0]?.allow).toBe("/");
    expect(robots.rules[0]?.disallow).toEqual(["/app", "/api/"]);
    expect(robots.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("lists only the public landing in the sitemap", () => {
    const entries = buildSitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe(getSiteUrl().origin);
  });
});
