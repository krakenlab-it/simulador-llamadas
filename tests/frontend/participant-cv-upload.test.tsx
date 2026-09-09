import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantCvUpload } from "@/app/components/kraken-lab/ParticipantCvUpload";
import type { PasanteProfile } from "@/lib/kraken-lab/types";

const emptyProfile: PasanteProfile = {
  fullName: "",
  age: 22,
  city: "",
  simulationCities: [],
  phone: "",
  email: "",
};

describe("ParticipantCvUpload", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens the native file picker from Subir CV", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(
      <ParticipantCvUpload
        profile={emptyProfile}
        onProfileChange={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Subir CV" }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows uploaded CV file name with Quitar", () => {
    render(
      <ParticipantCvUpload
        profile={{ ...emptyProfile, cvFileName: "santiago-mendoza.txt" }}
        onProfileChange={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    expect(screen.getByText("santiago-mendoza.txt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
  });
});
