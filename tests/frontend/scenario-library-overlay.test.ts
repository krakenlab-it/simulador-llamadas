import { beforeEach, describe, expect, it } from "vitest";
import {
  mergeLocalScenarioLibrary,
  readLocalLibraryPublishedSlugs,
  setLocalScenarioLibraryPublished,
} from "@/lib/frontend/scenario-library";
import { customGymScenarioFixture } from "@/tests/frontend/fixtures";

describe("scenario-library local overlay", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks slugs as published after setLocalScenarioLibraryPublished", () => {
    setLocalScenarioLibraryPublished("laura-gimnasio", true);
    expect(readLocalLibraryPublishedSlugs().has("laura-gimnasio")).toBe(true);
    const [merged] = mergeLocalScenarioLibrary([customGymScenarioFixture]);
    expect(merged.libraryPublishedAt).toBeTruthy();
  });
});
