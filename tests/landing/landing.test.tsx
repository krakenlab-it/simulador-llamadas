/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "@/app/components/landing/LandingPage";
import { APP_ENTRY_PATH } from "@/lib/landing/cta";
import { landingContent } from "@/lib/landing/content";

describe("landing page", () => {
  it("renders Spanish hero copy and feature sections", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain(landingContent.eyebrow);
    expect(html).toContain(landingContent.headlineHighlight);
    expect(html).toContain(landingContent.headlineRest);
    expect(html).toContain(landingContent.subheadline);
    expect(html).toContain(landingContent.ctaLabel);
    expect(html).toContain(landingContent.features[0].title);
    expect(html).toContain(landingContent.features[2].description);
    expect(html).toContain(landingContent.footer);
  });

  it("exposes a single Entrar CTA linking to the app entry path", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(APP_ENTRY_PATH).toBe("/app");
    expect(html).toContain(`href="${APP_ENTRY_PATH}"`);
    expect(html.match(new RegExp(`href="${APP_ENTRY_PATH}"`, "g"))).toHaveLength(1);
    expect(html).toContain(`>${landingContent.ctaLabel}<`);
  });
});
