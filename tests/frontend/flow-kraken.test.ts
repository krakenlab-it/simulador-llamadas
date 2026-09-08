import { describe, expect, it } from "vitest";
import {
  closeKrakenWizard,
  initialFlowState,
  navigate,
  openKrakenWizard,
} from "@/lib/frontend/flow";

describe("Kraken Lab wizard flow", () => {
  it("opens the wizard from train hub", () => {
    const train = navigate(initialFlowState(), "train");
    const wizard = openKrakenWizard(train);
    expect(wizard.view).toBe("kraken-wizard");
  });

  it("returns to train when closing the wizard", () => {
    const wizard = openKrakenWizard(navigate(initialFlowState(), "train"));
    expect(closeKrakenWizard(wizard).view).toBe("train");
  });
});
