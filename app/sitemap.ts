import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap();
}
