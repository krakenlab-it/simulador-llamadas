import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FALLBACK_GEMINI_MODEL,
  FALLBACK_GROQ_MODEL,
  GEMINI_TRANSCRIBE_MODEL,
  SHUT_DOWN_MODEL_IDS,
} from "@/lib/agent/models";

const ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["app", "lib", "components"];
const REGISTRY = join("lib", "agent", "models.ts");

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [full] : [];
  });
}

describe("no shut-down model ids (KAN-144)", () => {
  it("keeps shut-down ids out of app source (only the registry lists them)", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
        if (rel === REGISTRY) continue;
        const text = readFileSync(file, "utf8");
        for (const id of SHUT_DOWN_MODEL_IDS) {
          if (text.includes(id)) offenders.push(`${rel}: ${id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not configure any shut-down id", () => {
    for (const id of [FALLBACK_GROQ_MODEL, FALLBACK_GEMINI_MODEL, GEMINI_TRANSCRIBE_MODEL]) {
      expect(SHUT_DOWN_MODEL_IDS as readonly string[]).not.toContain(id);
    }
  });
});
