"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { ScenarioRecord } from "@/lib/scenarios/types";
import {
  isDuplicateMember,
  memberEmailError,
  memberInitials,
  memberNameError,
  teamNameError,
  teamScoreError,
} from "@/lib/teams/form";
import type {
  PracticeTeam,
  PracticeTeamMember,
  PracticeTeamTest,
} from "@/lib/teams/types";

interface TeamCompareScreenProps {
  traineeEmail: string | null;
  onPractice: (slug: string) => void;
}

type TeamStep = "equipo" | "personas" | "examen";

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
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [scenarioSlug, setScenarioSlug] = useState("mariana");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<TeamComparisonView | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [wonDrafts, setWonDrafts] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"team" | "member" | "exam" | "score" | null>(
    null,
  );
  const [teamError, setTeamError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const presets = listCatalogPresets();

  const selectedTeam = teams.find((team) => team.id === selectedId) ?? null;
  const step: TeamStep = !selectedId
    ? "equipo"
    : members.length < 2
      ? "personas"
      : "examen";

  const caseOptions = useMemo(() => {
    const clinic = presets.map((preset) => ({
      slug: preset.slug,
      label: preset.name,
      hint: preset.company,
    }));
    const custom = scenarios
      .filter((scenario) => !scenario.isPreset)
      .map((scenario) => ({
        slug: scenario.slug,
        label: scenario.clientName,
        hint: scenario.companyContext,
      }));
    return [...clinic, ...custom];
  }, [presets, scenarios]);

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
    setComparison(null);
  };

  useEffect(() => {
    void refreshTeams().then((next) => {
      if (next[0]) void loadTeam(next[0].id);
    });
    void listScenarios().then(setScenarios);
  }, []);

  const handleCreateTeam = async () => {
    const error = teamNameError(teamName);
    if (error) {
      setTeamError(error);
      return;
    }
    setTeamError(null);
    setBusy("team");
    try {
      const team = await createTeam({
        name: teamName,
        createdBy: traineeEmail,
      });
      setTeamName("");
      setCreatingTeam(false);
      await refreshTeams();
      await loadTeam(team.id);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo crear el equipo.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleAddMember = async () => {
    if (!selectedId) {
      setMemberError("Crea o elige un equipo antes de sumar personas.");
      return;
    }
    const nameIssue = memberNameError(memberName);
    if (nameIssue) {
      setMemberError(nameIssue);
      return;
    }
    const emailIssue = memberEmailError(memberEmail);
    if (emailIssue) {
      setMemberError(emailIssue);
      return;
    }
    if (isDuplicateMember(memberName, members)) {
      setMemberError("Esa persona ya está en el equipo.");
      return;
    }
    setMemberError(null);
    setBusy("member");
    try {
      await addTeamMember(selectedId, {
        displayName: memberName.trim(),
        email: memberEmail.trim() || null,
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
      setBusy(null);
    }
  };

  const handleCreateTest = async () => {
    if (!selectedId) return;
    setBusy("exam");
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
      setBusy(null);
    }
  };

  const handleRecord = async (memberId: string) => {
    if (!selectedId || !selectedTestId) return;
    const score = Number(scoreDrafts[memberId] ?? "");
    const scoreIssue = teamScoreError(score);
    if (scoreIssue) {
      showToast(scoreIssue, "error");
      return;
    }
    setBusy("score");
    try {
      await recordTeamResult(selectedId, selectedTestId, {
        memberId,
        totalScore: score,
        won: wonDrafts[memberId] === true,
        turnsCompleted: 5,
      });
      setComparison(await compareTeamTest(selectedId, selectedTestId));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo guardar el puntaje.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleCompare = async () => {
    if (!selectedId || !selectedTestId) return;
    setBusy("score");
    try {
      setComparison(await compareTeamTest(selectedId, selectedTestId));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo comparar.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="team-compare">
      <header className="page-hero">
        <p className="page-hero__eyebrow">Mismo examen</p>
        <h1 className="page-hero__title">Arma el equipo y compáralos</h1>
        <p className="page-hero__subtitle">
          Un grupo, las mismas personas, el mismo caso. Primero el equipo,
          luego quién practica, luego el examen. El coaching lo escribe el
          servidor.
        </p>
      </header>

      <ol className="team-progress" aria-label="Pasos para comparar">
        <li aria-current={step === "equipo" ? "step" : undefined}>
          1. Equipo
        </li>
        <li aria-current={step === "personas" ? "step" : undefined}>
          2. Personas
        </li>
        <li aria-current={step === "examen" ? "step" : undefined}>
          3. Examen
        </li>
      </ol>

      {!selectedId ? (
        <Card className="team-setup">
          <h2>¿Cómo se llama el equipo?</h2>
          <p className="team-empty" role="status">
            Aún no hay equipos. Ponle un nombre claro — por ejemplo el grupo de
            pasantes — y sigue con las personas.
          </p>
          <form
            className="team-setup__form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateTeam();
            }}
          >
            <label className="agent-field">
              <span>Nombre del equipo</span>
              <input
                value={teamName}
                onChange={(event) => {
                  setTeamName(event.target.value);
                  if (teamError) setTeamError(null);
                }}
                placeholder="Jaime / pasantes"
                aria-invalid={Boolean(teamError) || undefined}
                aria-describedby={teamError ? "team-name-error" : undefined}
              />
            </label>
            {teamError ? (
              <p id="team-name-error" className="team-form-error" role="alert">
                {teamError}
              </p>
            ) : null}
            <Button type="submit" variant="primary" loading={busy === "team"}>
              Crear equipo
            </Button>
          </form>
        </Card>
      ) : (
        <div className="team-workspace">
          <Card className="team-workspace__people">
            <div className="team-workspace__head">
              <div>
                <p className="team-workspace__eyebrow">Equipo activo</p>
                <h2>{selectedTeam?.name ?? "Equipo"}</h2>
              </div>
              <div className="team-switcher" role="group" aria-label="Equipos">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    className={team.id === selectedId ? "is-active" : ""}
                    aria-pressed={team.id === selectedId}
                    onClick={() => void loadTeam(team.id)}
                  >
                    {team.name}
                  </button>
                ))}
                <button
                  type="button"
                  className={creatingTeam ? "is-active" : ""}
                  aria-expanded={creatingTeam}
                  onClick={() => setCreatingTeam((open) => !open)}
                >
                  + Nuevo
                </button>
              </div>
            </div>

            {creatingTeam ? (
              <form
                className="team-setup__form team-setup__form--inline"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateTeam();
                }}
              >
                <label className="agent-field">
                  <span>Nombre del equipo</span>
                  <input
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="Jaime / pasantes"
                  />
                </label>
                {teamError ? (
                  <p className="team-form-error" role="alert">
                    {teamError}
                  </p>
                ) : null}
                <Button type="submit" loading={busy === "team"}>
                  Crear equipo
                </Button>
              </form>
            ) : null}

            <h3>Quién practica</h3>
            {members.length === 0 ? (
              <p className="team-empty" role="status">
                Suma a la gente de una en una. Con dos ya puedes comparar.
              </p>
            ) : (
              <ul className="team-chips" aria-label="Personas del equipo">
                {members.map((member) => (
                  <li key={member.id} className="team-chip">
                    <span className="team-chip__avatar" aria-hidden="true">
                      {memberInitials(member.displayName)}
                    </span>
                    <span>
                      <strong>{member.displayName}</strong>
                      {member.email ? <small>{member.email}</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="team-member-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddMember();
              }}
            >
              <label className="agent-field">
                <span>Nombre</span>
                <input
                  value={memberName}
                  onChange={(event) => {
                    setMemberName(event.target.value);
                    if (memberError) setMemberError(null);
                  }}
                  placeholder="Jaime"
                  aria-invalid={Boolean(memberError) || undefined}
                />
              </label>
              <label className="agent-field">
                <span>Correo (opcional)</span>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(event) => {
                    setMemberEmail(event.target.value);
                    if (memberError) setMemberError(null);
                  }}
                  placeholder="jaime@equipo"
                />
              </label>
              <Button type="submit" loading={busy === "member"}>
                Sumar
              </Button>
            </form>
            {memberError ? (
              <p className="team-form-error" role="alert">
                {memberError}
              </p>
            ) : null}
          </Card>

          <Card className="team-workspace__exam">
            <h2>Mismo caso para todos</h2>
            <p className="team-empty">
              Clínica o un caso que hayas guardado en Agente (Kraken Flow,
              Me We, Wellness). Todos enfrentan al mismo cliente.
            </p>
            <fieldset className="team-case-grid">
              <legend className="visually-hidden">Caso del examen</legend>
              {caseOptions.map((option) => (
                <label
                  key={option.slug}
                  className={`team-case ${scenarioSlug === option.slug ? "is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="team-case"
                    value={option.slug}
                    checked={scenarioSlug === option.slug}
                    onChange={() => setScenarioSlug(option.slug)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="team-actions">
              <Button
                variant="primary"
                loading={busy === "exam"}
                disabled={members.length < 1}
                onClick={() => void handleCreateTest()}
              >
                Crear examen
              </Button>
              <Button onClick={() => onPractice(scenarioSlug)}>
                Ir a practicar
              </Button>
            </div>
            {tests.length > 0 ? (
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
            ) : null}
          </Card>
        </div>
      )}

      {selectedId && selectedTestId ? (
        <Card className="team-scores">
          <h2>Resultados del mismo test</h2>
          {members.length === 0 ? (
            <p className="team-empty" role="status">
              Suma personas y vuelve aquí para cargar puntajes.
            </p>
          ) : null}
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
              <label className="team-score-row__won">
                <input
                  type="checkbox"
                  checked={wonDrafts[member.id] === true}
                  onChange={(event) =>
                    setWonDrafts((prev) => ({
                      ...prev,
                      [member.id]: event.target.checked,
                    }))
                  }
                  aria-label={`${member.displayName} cerró con día y hora`}
                />
                Cerró con día y hora
              </label>
              <Button
                loading={busy === "score"}
                onClick={() => void handleRecord(member.id)}
              >
                Guardar
              </Button>
            </div>
          ))}
          <Button
            variant="primary"
            loading={busy === "score"}
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
          <table className="team-comparison__table">
            <caption className="visually-hidden">
              Resultados del mismo examen
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Puntaje</th>
                <th scope="col">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {comparison.members.map((member) => (
                <tr key={member.memberId}>
                  <th scope="row">{member.displayName}</th>
                  <td>{member.totalScore} pts</td>
                  <td>{member.won ? "Ganó" : "No ganó"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
