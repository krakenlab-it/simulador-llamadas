"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
  addTeamMember,
  compareTeamTest,
  createTeam,
  createTeamTest,
  getTeam,
  listScenarios,
  listTeams,
  recordTeamResult,
} from "@/lib/api/client";
import type { TeamComparisonView } from "@/lib/agent/types";
import { listCatalogPresets } from "@/lib/scenarios/catalog-presets";
import type {
  PracticeTeam,
  PracticeTeamMember,
  PracticeTeamTest,
} from "@/lib/teams/types";

interface TeamCompareScreenProps {
  traineeEmail: string | null;
  onPractice: (slug: string) => void;
}

export function TeamCompareScreen({
  traineeEmail,
  onPractice,
}: TeamCompareScreenProps) {
  const { showToast } = useToast();
  const [teams, setTeams] = useState<PracticeTeam[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<PracticeTeamMember[]>([]);
  const [tests, setTests] = useState<PracticeTeamTest[]>([]);
  const [teamName, setTeamName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [scenarioSlug, setScenarioSlug] = useState("mariana");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<TeamComparisonView | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const presets = listCatalogPresets();

  const refreshTeams = async () => {
    const next = await listTeams();
    setTeams(next);
    return next;
  };

  const loadTeam = async (teamId: string) => {
    const snapshot = await getTeam(teamId);
    setSelectedId(teamId);
    setMembers(snapshot.members);
    setTests(snapshot.tests);
    if (snapshot.tests[0]) setSelectedTestId(snapshot.tests[0].id);
  };

  useEffect(() => {
    void refreshTeams().then((next) => {
      if (next[0]) void loadTeam(next[0].id);
    });
    void listScenarios();
  }, []);

  const handleCreateTeam = async () => {
    setBusy(true);
    try {
      const team = await createTeam({
        name: teamName,
        createdBy: traineeEmail,
      });
      setTeamName("");
      await refreshTeams();
      await loadTeam(team.id);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo crear el equipo.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await addTeamMember(selectedId, {
        displayName: memberName,
        email: memberEmail || null,
      });
      setMemberName("");
      setMemberEmail("");
      await loadTeam(selectedId);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo agregar.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTest = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const test = await createTeamTest(selectedId, { scenarioSlug });
      await loadTeam(selectedId);
      setSelectedTestId(test.id);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo crear el examen.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRecord = async (memberId: string) => {
    if (!selectedId || !selectedTestId) return;
    const score = Number(scoreDrafts[memberId] ?? "0");
    setBusy(true);
    try {
      await recordTeamResult(selectedId, selectedTestId, {
        memberId,
        totalScore: score,
        won: score >= 70,
        turnsCompleted: 5,
      });
      const next = await compareTeamTest(selectedId, selectedTestId);
      setComparison(next);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo guardar el puntaje.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedId || !selectedTestId) return;
    setBusy(true);
    try {
      setComparison(await compareTeamTest(selectedId, selectedTestId));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo comparar.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="team-compare">
      <header className="page-hero">
        <p className="page-hero__eyebrow">Mismo examen</p>
        <h1 className="page-hero__title">Equipos y comparación</h1>
        <p className="page-hero__subtitle">
          Crea un equipo, suma miembros y ponlos en el mismo caso PREFILLED.
          El backend genera la comparación — no el navegador.
        </p>
      </header>

      <div className="team-compare__grid">
        <Card>
          <h2>Equipo</h2>
          <label className="agent-field">
            <span>Nombre del equipo</span>
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Jaime / pasantes"
            />
          </label>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void handleCreateTeam()}
          >
            Crear equipo
          </Button>
          <ul className="team-list">
            {teams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  className={team.id === selectedId ? "is-active" : ""}
                  onClick={() => void loadTeam(team.id)}
                >
                  {team.name}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2>Miembros</h2>
          <label className="agent-field">
            <span>Nombre</span>
            <input
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
              placeholder="Jaime"
            />
          </label>
          <label className="agent-field">
            <span>Correo (opcional)</span>
            <input
              value={memberEmail}
              onChange={(event) => setMemberEmail(event.target.value)}
              placeholder="jaime@equipo"
            />
          </label>
          <Button loading={busy} onClick={() => void handleAddMember()}>
            Agregar miembro
          </Button>
          <ul className="team-list">
            {members.map((member) => (
              <li key={member.id}>
                {member.displayName}
                {member.email ? ` · ${member.email}` : ""}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2>Mismo examen</h2>
          <label className="agent-field">
            <span>Escenario PREFILLED</span>
            <select
              value={scenarioSlug}
              onChange={(event) => setScenarioSlug(event.target.value)}
            >
              {presets.map((preset) => (
                <option key={preset.slug} value={preset.slug}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <div className="team-actions">
            <Button loading={busy} onClick={() => void handleCreateTest()}>
              Crear examen
            </Button>
            <Button onClick={() => onPractice(scenarioSlug)}>
              Ir a practicar
            </Button>
          </div>
          <ul className="team-list">
            {tests.map((test) => (
              <li key={test.id}>
                <button
                  type="button"
                  className={test.id === selectedTestId ? "is-active" : ""}
                  onClick={() => setSelectedTestId(test.id)}
                >
                  {test.title}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {selectedTestId ? (
        <Card className="team-scores">
          <h2>Resultados del mismo test</h2>
          {members.map((member) => (
            <div key={member.id} className="team-score-row">
              <span>{member.displayName}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={scoreDrafts[member.id] ?? ""}
                onChange={(event) =>
                  setScoreDrafts((prev) => ({
                    ...prev,
                    [member.id]: event.target.value,
                  }))
                }
                aria-label={`Puntaje de ${member.displayName}`}
              />
              <Button
                loading={busy}
                onClick={() => void handleRecord(member.id)}
              >
                Guardar
              </Button>
            </div>
          ))}
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void handleCompare()}
          >
            Comparar
          </Button>
        </Card>
      ) : null}

      {comparison ? (
        <Card className="team-comparison">
          <h2>Comparación</h2>
          <p>{comparison.narrative}</p>
          <ul>
            {comparison.members.map((member) => (
              <li key={member.memberId}>
                {member.displayName}: {member.totalScore} pts
                {member.won ? " · ganó" : ""}
              </li>
            ))}
          </ul>
          <h3>Huecos</h3>
          <ul>
            {comparison.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          <h3>Coaching</h3>
          <ul>
            {comparison.coaching.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
