import { describe, expect, it } from "vitest";
import {
  MIN_CONVAI_SECONDS_TO_CONSUME_DAILY_SLOT,
} from "@/lib/voice/brakes";

describe("daily billed session consumption threshold", () => {
  it("requires meaningful ConvAI seconds before counting as consumed", () => {
    expect(MIN_CONVAI_SECONDS_TO_CONSUME_DAILY_SLOT).toBeGreaterThan(1);
  });
});
