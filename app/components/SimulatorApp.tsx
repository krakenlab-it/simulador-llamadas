"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSession,
  endSession,
  getSessionDetail,
  listScenarios,
  type EndSessionResponse,
  type TurnSummary,
} from "@/lib/api/client";
import { appendLocalHistory } from "@/lib/history/local";
import { sessionToShellUser } from "@/lib/frontend/auth-shell";
import {
  beginStarting,
  closeBuilder,
  enterCall,
  enterDetail,
  enterResults,
  initialFlowState,
  navigate,
  openBuilder,
  resetToHome,
  resetToTrain,
  type AppView,
  type FlowState,
} from "@/lib/frontend/flow";
import {
  canAccessView,
  resolveShellTabForView,
  viewForShellTab,
  type ShellTab,
} from "@/lib/frontend/role-navigation";
import {
  clearProductRole,
  readProductRole,
  writeProductRole,
  type ProductRole,
} from "@/lib/frontend/product-role";
import {
  activeProject,
  assignmentForAgent,
  defaultCapacitadorAssignmentSeed,
  readTrainingOffice,
  writeTrainingOffice,
} from "@/lib/frontend/training-office";
import { displayNameFromProfile } from "@/lib/frontend/agent-profile";
import { isScenarioPublishedToLibrary } from "@/lib/scenarios/types";
import { AppShell } from "@/app/components/shell/AppShell";
import { AgentHarnessScreen } from "@/app/components/agent/AgentHarnessScreen";
import { TeamCompareScreen } from "@/app/components/teams/TeamCompareScreen";
import { ScreenTransition } from "@/app/components/ui/ScreenTransition";
import { Spinner } from "@/app/components/ui/Spinner";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import {
  ScenarioHub,
  type SetupConfig,
} from "@/app/components/training/ScenarioHub";
import { ScenarioBuilderScreen } from "@/app/components/training/ScenarioBuilderScreen";
import { LiveCallScreen } from "@/app/components/call/LiveCallScreen";
import { ResultsScreen } from "@/app/components/results/ResultsScreen";
import { HistoryView } from "@/app/components/history/HistoryView";
import { AuthScreen } from "@/app/components/AuthScreen";
import { AuthProvider, useAuth } from "@/lib/auth/context";
import type { ScenarioRecord } from "@/lib/scenarios/types";
import { replaySetupFromDetail } from "@/lib/frontend/replay-setup";
import { durationSecondsBetween } from "@/lib/session/duration";
import { RolePickerScreen } from "@/app/components/role/RolePickerScreen";
import { CapacitadorHomeScreen } from "@/app/components/role/CapacitadorHomeScreen";
import { AgenteHomeScreen } from "@/app/components/role/AgenteHomeScreen";
import { CapacitadorAssignmentsScreen } from "@/app/components/role/CapacitadorAssignmentsScreen";
import { TrainerGradesPanel } from "@/app/components/role/TrainerGradesPanel";

interface EvaluationState {
  result: EndSessionResponse;
  turns: TurnSummary[];
}

function SimulatorShell() {
  const { session, loading, signOut } = useAuth();
  const { showToast } = useToast();
  const [textOnly, setTextOnly] = useState(false);
  const [productRole, setProductRole] = useState<ProductRole | null>(null);
  const [roleHydrated, setRoleHydrated] = useState(false);
  const [flow, setFlow] = useState<FlowState>(initialFlowState);
  const [callAttemptId, setCallAttemptId] = useState<string | null>(null);
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationState | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [openingDetail, setOpeningDetail] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [scenarioRefresh, setScenarioRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [selectedSlugOnLoad, setSelectedSlugOnLoad] = useState<string | null>(
    null,
  );
  const [builderScenario, setBuilderScenario] = useState<ScenarioRecord | null>(
    null,
  );
  const [officeRevision, setOfficeRevision] = useState(0);

  useEffect(() => {
    setProductRole(readProductRole());
    setRoleHydrated(true);
  }, []);

  useEffect(() => {
    if (productRole !== "capacitador") return;
    void listScenarios().then((rows) => {
      const published = rows
        .filter(
          (s) =>
            !s.isPreset &&
            isScenarioPublishedToLibrary(s) &&
            !s.deactivatedAt,
        )
        .map((s) => s.slug);
      const office = readTrainingOffice();
      const seeded = defaultCapacitadorAssignmentSeed(office, published);
      if (seeded !== office) {
        writeTrainingOffice(seeded);
        setOfficeRevision((k) => k + 1);
      }
    });
  }, [productRole]);

  const shellUser = useMemo(
    () => (session?.user ? sessionToShellUser(session.user) : null),
    [session],
  );

  const isStarting = flow.phase === "starting";
  const traineeEmail = session?.user.email ?? null;

  const office = useMemo(
    () => readTrainingOffice(),
    // officeRevision bumps after demo seed writes
    [officeRevision],
  );
  const agentAssignment = useMemo(() => {
    if (productRole !== "agente") return null;
    const project = activeProject(office, "agente");
    return assignmentForAgent(office, project.id, traineeEmail);
  }, [productRole, office, traineeEmail]);

  const agenteDisplayName = useMemo(() => {
    if (agentAssignment?.profile) {
      return displayNameFromProfile(
        agentAssignment.profile,
        shellUser?.displayName ?? "Agente",
      );
    }
    return shellUser?.displayName ?? "Agente";
  }, [agentAssignment, shellUser]);

  const handleTabChange = useCallback(
    (tab: ShellTab) => {
      if (!productRole) return;
      const target = viewForShellTab(tab);
      setFlow((prev) => navigate(prev, target));
    },
    [productRole],
  );

  const goToView = useCallback((view: AppView) => {
    if (!productRole || !canAccessView(productRole, view)) return;
    setFlow((prev) => navigate(prev, view));
  }, [productRole]);

  const handleViewHistoryAfterCall = useCallback(() => {
    setHistoryRefresh((k) => k + 1);
    if (productRole === "agente") {
      setFlow((prev) => navigate(prev, "history"));
      return;
    }
    setFlow(resetToHome);
  }, [productRole]);

  const handleStart = useCallback(
    async (setup: SetupConfig) => {
      setFlow((prev) => beginStarting(prev));
      try {
        const created = await createSession({
          scenarioSlug: setup.scenarioSlug,
          mode: setup.mode,
          difficultyLevel: setup.difficultyLevel,
          traineeId: traineeId ?? undefined,
          traineeEmail: traineeEmail ?? undefined,
          traineeAuthUserId: session?.user.id,
          traineeDisplayName: shellUser?.displayName,
        });
        setTraineeId(created.traineeId);
        setCallAttemptId(created.callAttemptId);
        setCallStartedAt(new Date().toISOString());
        setConfig({
          ...setup,
          totalRounds: created.totalRounds ?? setup.totalRounds,
        });
        setEvaluation(null);
        setFlow(() => enterCall());
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la llamada. Intenta de nuevo.";
        showToast(message, "error");
        setFlow((prev) => ({ ...prev, phase: "idle" }));
      }
    },
    [showToast, traineeId, traineeEmail, session?.user.id, shellUser?.displayName],
  );

  const handleHangUp = useCallback(
    async (turns: TurnSummary[]) => {
      if (!callAttemptId || !config || ending) return;
      setEvaluating(true);
      setEnding(true);
      setFlow(() => enterResults());
      try {
        const result = await endSession(callAttemptId);
        const startedAt = callStartedAt ?? new Date().toISOString();
        appendLocalHistory({
          callAttemptId,
          scenarioSlug: config.scenarioSlug,
          clientName: config.clientName,
          difficultyLevel: config.difficultyLevel,
          mode: config.mode,
          won: result.won,
          totalScore: result.totalScore,
          turnsCompleted: result.turnsCompleted,
          startedAt,
          durationSeconds: durationSecondsBetween(startedAt, new Date().toISOString()),
        });
        setEvaluation({ result, turns });
        setHistoryRefresh((k) => k + 1);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo finalizar la llamada.";
        showToast(message, "error");
      } finally {
        setEvaluating(false);
        setEnding(false);
      }
    },
    [callAttemptId, config, callStartedAt, ending, showToast],
  );

  const handleOpenCall = useCallback(
    async (id: string) => {
      if (openingDetail) return;
      setOpeningDetail(true);
      try {
        const detail = await getSessionDetail(id);
        if (!detail.evaluation) {
          showToast("Esta llamada aún no tiene scorecard guardado.", "error");
          return;
        }
        setCallAttemptId(detail.callAttemptId);
        setTraineeId(detail.traineeId);
        setConfig(replaySetupFromDetail(detail));
        setEvaluation({
          result: {
            callAttemptId: detail.callAttemptId,
            status: detail.status === "completed" ? "completed" : "abandoned",
            won: detail.won ?? false,
            totalScore: detail.totalScore ?? 0,
            turnsCompleted: detail.turnsCompleted,
            totalRounds: detail.totalRounds,
            evaluation: detail.evaluation,
          },
          turns: detail.turns,
        });
        setFlow(() => enterDetail());
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo abrir esta llamada.";
        showToast(message, "error");
      } finally {
        setOpeningDetail(false);
      }
    },
    [openingDetail, showToast],
  );

  const handleRepeat = useCallback(async () => {
    if (!config || isStarting) return;
    setEvaluation(null);
    await handleStart(config);
  }, [config, handleStart, isStarting]);

  const handleNewScenario = useCallback(() => {
    setCallAttemptId(null);
    setCallStartedAt(null);
    setConfig(null);
    setEvaluation(null);
    setFlow(resetToTrain);
  }, []);

  const handleScenarioSaved = useCallback(
    (slug: string) => {
      setScenarioRefresh((k) => k + 1);
      setSelectedSlugOnLoad(slug);
      setFlow(resetToTrain);
      showToast("Caso listo para practicar.", "success");
    },
    [showToast],
  );

  const handleSelectRole = useCallback((role: ProductRole) => {
    writeProductRole(role);
    setProductRole(role);
    setFlow(initialFlowState());
  }, []);

  const handleChangeRole = useCallback(() => {
    clearProductRole();
    setProductRole(null);
    setFlow(initialFlowState());
  }, []);

  if (loading || !roleHydrated) {
    return (
      <main>
        <div className="loading-overlay" role="status" aria-live="polite">
          <Spinner label="Cargando" />
          <span>Cargando…</span>
        </div>
      </main>
    );
  }

  if (!session && !textOnly) {
    return (
      <main>
        <AuthScreen
          onAuthenticated={() => {
            /* AuthProvider picks up the new session automatically. */
          }}
          onContinueTextOnly={() => setTextOnly(true)}
        />
      </main>
    );
  }

  if (!productRole) {
    return (
      <main className="app-main app-main--auth">
        <RolePickerScreen onSelect={handleSelectRole} />
      </main>
    );
  }

  const compactShell = flow.view === "call";
  const showScorecard =
    (flow.view === "results" || flow.view === "detail") && config;

  const activeTab = resolveShellTabForView(flow.view, productRole);
  const showGradesToAgente = agentAssignment?.showGradesToAgent ?? true;

  return (
    <AppShell
      user={
        shellUser ?? {
          id: "guest",
          displayName: "Invitado",
          email: "modo texto",
          initials: "TX",
        }
      }
      productRole={productRole}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onChangeRole={handleChangeRole}
      onSignOut={session ? () => void signOut() : undefined}
      compact={compactShell}
    >
      <ScreenTransition screenKey={flow.view}>
        {flow.view === "home" && productRole === "capacitador" ? (
          <CapacitadorHomeScreen />
        ) : null}

        {flow.view === "home" && productRole === "agente" ? (
          <AgenteHomeScreen
            agentEmail={traineeEmail}
            agentDisplayName={agenteDisplayName}
            agentProfile={agentAssignment?.profile ?? null}
            onOpenPractice={() => goToView("train")}
            onOpenResults={() => goToView("history")}
          />
        ) : null}

        {flow.view === "history" ? (
          <div className="grades-stack">
            {productRole === "capacitador" ? <TrainerGradesPanel /> : null}
            <HistoryView
              refreshKey={historyRefresh}
              traineeId={traineeId}
              traineeEmail={traineeEmail}
              audience={productRole === "capacitador" ? "capacitador" : "agente"}
              showScoreDetails={
                productRole === "capacitador" ? true : showGradesToAgente
              }
              onStartTraining={() => handleTabChange("train")}
              onOpenCall={(id) => void handleOpenCall(id)}
            />
          </div>
        ) : null}

        {flow.view === "train" && (
          <ScenarioHub
            refreshKey={scenarioRefresh}
            selectedSlugOnLoad={selectedSlugOnLoad}
            isStarting={isStarting}
            hubMode={productRole}
            assignedScenarioSlugs={agentAssignment?.scenarioSlugs ?? null}
            onStart={(c) => void handleStart(c)}
            onCreateScenario={() => {
              if (productRole !== "capacitador") return;
              setBuilderScenario(null);
              setFlow((prev) => openBuilder(prev));
            }}
            onEditScenario={(scenario) => {
              if (productRole !== "capacitador") return;
              setBuilderScenario(scenario);
              setFlow((prev) => openBuilder(prev));
            }}
          />
        )}

        {flow.view === "builder" && productRole === "capacitador" && (
          <ScenarioBuilderScreen
            initialScenario={builderScenario}
            onCancel={() => {
              setBuilderScenario(null);
              setFlow((prev) => closeBuilder(prev));
            }}
            onSave={({ scenario }) => handleScenarioSaved(scenario.slug)}
          />
        )}

        {flow.view === "agent" && productRole === "capacitador" && (
          <AgentHarnessScreen onScenarioSaved={handleScenarioSaved} />
        )}

        {flow.view === "teams" && productRole === "capacitador" && (
          <CapacitadorAssignmentsScreen>
            <TeamCompareScreen
              traineeEmail={traineeEmail}
              onPractice={(slug) => {
                setSelectedSlugOnLoad(slug);
                setFlow(resetToTrain);
              }}
            />
          </CapacitadorAssignmentsScreen>
        )}

        {flow.view === "call" && callAttemptId && config && (
          <LiveCallScreen
            callAttemptId={callAttemptId}
            clientName={config.clientName}
            scenarioSlug={config.scenarioSlug}
            isPreset={config.isPreset}
            client={config.client}
            mode={config.mode}
            level={config.difficultyLevel}
            totalRounds={config.totalRounds}
            phaseLabels={config.phaseLabels}
            openingLine={config.openingLine}
            buyerTemperament={config.temperament}
            buyerDifficultyLabel={config.difficultyLabel}
            verifiedUserId={config.verifiedUserId}
            voiceAgent={config.voiceAgent}
            ending={ending}
            onHangUp={(turns) => void handleHangUp(turns)}
          />
        )}

        {showScorecard ? (
          <ResultsScreen
            result={evaluation?.result ?? null}
            turns={evaluation?.turns ?? []}
            clientName={config.clientName}
            scenarioSlug={config.scenarioSlug}
            totalRounds={config.totalRounds}
            loading={evaluating || openingDetail}
            onRepeat={() => void handleRepeat()}
            onNewScenario={handleNewScenario}
            onViewHistory={handleViewHistoryAfterCall}
            historyActionLabel={
              productRole === "agente" ? "Volver a mis resultados" : "Volver al inicio"
            }
          />
        ) : null}
      </ScreenTransition>
    </AppShell>
  );
}

export function SimulatorApp() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SimulatorShell />
      </ToastProvider>
    </AuthProvider>
  );
}
