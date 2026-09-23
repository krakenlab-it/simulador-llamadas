import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamCompareScreen } from "@/app/components/teams/TeamCompareScreen";
import { ToastProvider } from "@/components/ui/Toast";

const listTeams = vi.fn();
const createTeam = vi.fn();
const getTeam = vi.fn();
const addTeamMember = vi.fn();
const createTeamTest = vi.fn();
const recordTeamResult = vi.fn();
const compareTeamTest = vi.fn();
const listScenarios = vi.fn();

vi.mock("@/lib/api/client", () => ({
  listTeams: (...args: unknown[]) => listTeams(...args),
  createTeam: (...args: unknown[]) => createTeam(...args),
  getTeam: (...args: unknown[]) => getTeam(...args),
  addTeamMember: (...args: unknown[]) => addTeamMember(...args),
  createTeamTest: (...args: unknown[]) => createTeamTest(...args),
  recordTeamResult: (...args: unknown[]) => recordTeamResult(...args),
  compareTeamTest: (...args: unknown[]) => compareTeamTest(...args),
  listScenarios: (...args: unknown[]) => listScenarios(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeamCompareScreen", () => {
  it("creates a team, adds Jaime, records two scores and compares", async () => {
    const user = userEvent.setup();
    listTeams.mockResolvedValue([]);
    listScenarios.mockResolvedValue([]);
    createTeam.mockResolvedValue({
      id: "team-1",
      name: "Jaime / pasantes",
      createdBy: null,
      createdAt: "2026-09-18",
    });
    getTeam.mockResolvedValue({
      team: {
        id: "team-1",
        name: "Jaime / pasantes",
        createdBy: null,
        createdAt: "2026-09-18",
      },
      members: [
        {
          id: "m-jaime",
          teamId: "team-1",
          displayName: "Jaime",
          email: null,
          createdAt: "2026-09-18",
        },
        {
          id: "m-ana",
          teamId: "team-1",
          displayName: "Ana",
          email: null,
          createdAt: "2026-09-18",
        },
      ],
      tests: [
        {
          id: "test-1",
          teamId: "team-1",
          scenarioSlug: "mariana",
          title: "Mismo examen · mariana",
          createdAt: "2026-09-18",
        },
      ],
    });
    addTeamMember.mockResolvedValue({});
    createTeamTest.mockResolvedValue({
      id: "test-1",
      teamId: "team-1",
      scenarioSlug: "mariana",
      title: "Mismo examen · mariana",
    });
    recordTeamResult.mockResolvedValue({});
    compareTeamTest.mockResolvedValue({
      teamId: "team-1",
      teamName: "Jaime / pasantes",
      testId: "test-1",
      scenarioSlug: "mariana",
      title: "Mismo examen · mariana",
      members: [
        {
          memberId: "m-jaime",
          displayName: "Jaime",
          totalScore: 80,
          won: true,
          turnsCompleted: 5,
        },
        {
          memberId: "m-ana",
          displayName: "Ana",
          totalScore: 50,
          won: false,
          turnsCompleted: 5,
        },
      ],
      leaderName: "Jaime",
      gaps: ["La diferencia es 30 puntos."],
      coaching: ["Hablen de visitas al local."],
      narrative: "Jaime va adelante en el mismo examen.",
    });

    render(
      <ToastProvider>
        <TeamCompareScreen traineeEmail={null} onPractice={vi.fn()} />
      </ToastProvider>,
    );

    expect(screen.getByText(/Aún no hay equipos/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Arma el equipo/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear equipo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nombre del equipo/i);

    await user.type(screen.getByPlaceholderText(/Jaime \/ pasantes/i), "Jaime / pasantes");
    await user.click(screen.getByRole("button", { name: "Crear equipo" }));
    await waitFor(() => expect(createTeam).toHaveBeenCalled());

    const jaimeScore = await screen.findByLabelText("Puntaje de Jaime");
    expect(jaimeScore).toBeInTheDocument();
    await user.type(jaimeScore, "80");
    await user.click(screen.getAllByRole("button", { name: "Guardar" })[0]);
    expect(await screen.findByText(/Jaime va adelante/i)).toBeInTheDocument();
    expect(screen.getByText(/local/i)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Puntaje" })).toBeInTheDocument();
  });

  it("adds a person as a chip after the team exists", async () => {
    const user = userEvent.setup();
    listTeams.mockResolvedValue([
      {
        id: "team-1",
        name: "Jaime / pasantes",
        createdBy: null,
        createdAt: "2026-09-18",
      },
    ]);
    listScenarios.mockResolvedValue([]);
    getTeam.mockResolvedValue({
      team: {
        id: "team-1",
        name: "Jaime / pasantes",
        createdBy: null,
        createdAt: "2026-09-18",
      },
      members: [],
      tests: [],
    });
    addTeamMember.mockResolvedValue({});

    render(
      <ToastProvider>
        <TeamCompareScreen traineeEmail={null} onPractice={vi.fn()} />
      </ToastProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Jaime / pasantes" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sumar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nombre/i);

    getTeam.mockResolvedValueOnce({
      team: {
        id: "team-1",
        name: "Jaime / pasantes",
        createdBy: null,
        createdAt: "2026-09-18",
      },
      members: [
        {
          id: "m-ana",
          teamId: "team-1",
          displayName: "Ana",
          email: "ana@equipo.com",
          createdAt: "2026-09-18",
        },
      ],
      tests: [],
    });
    await user.type(screen.getByPlaceholderText("Jaime"), "Ana");
    await user.type(screen.getByPlaceholderText("jaime@equipo"), "ana@equipo.com");
    await user.click(screen.getByRole("button", { name: "Sumar" }));
    await waitFor(() =>
      expect(addTeamMember).toHaveBeenCalledWith("team-1", {
        displayName: "Ana",
        email: "ana@equipo.com",
      }),
    );
    expect(await screen.findByText("ana@equipo.com")).toBeInTheDocument();
  });
});
