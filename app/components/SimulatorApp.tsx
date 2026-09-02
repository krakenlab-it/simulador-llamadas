"use client";

import { useCallback, useMemo, useState } from "react";
import {
  createSession,
  endSession,
  getSessionDetail,
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
import { AppShell, type ShellTab } from "@/app/components/shell/AppShell";
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
import { phaseLabelsForCall } from "@/lib/scenarios/authoring";
import { durationSecondsBetween } from "@/lib/session/duration";
import { DEFAULT_VOICE_AGENT_SETTINGS } from "@/lib/voice/agent-settings";

interface EvaluationState {
  result: EndSessionResponse;
  turns: TurnSummary[];
}

function shellTabFromView(view: AppView): ShellTab {
  switch (view) {
    case "home":
    case "history":
    case "detail":
    case "results":
      return "home";
    case "train":
    case "builder":
    case "call":
      return "train";
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

function tabToView(tab: ShellTab): AppView {
  switch (tab) {
    case "home":
      return "home";
    case "train":
      return "train";
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

function SimulatorShell() {
  const { session, loading, signOut } = useAuth();
  const { showToast } = useToast();
  const [textOnly, setTextOnly] = useState(false);
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

  const shellUser = useMemo(
    () => (session?.user ? sessionToShellUser(session.user) : null),
    [session],
  );

  const isStarting = flow.phase === "starting";
  const traineeEmail = session?.user.email ?? null;

  const handleTabChange = useCallback((tab: ShellTab) => {
    setFlow((prev) => navigate(prev, tabToView(tab)));
  }, []);

  const handleGoHome = useCallback(() => {
    setFlow(resetToHome);
    setHistoryRefresh((k) => k + 1);
  }, []);

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
        setConfig({
          scenarioSlug: detail.scenarioSlug,
          clientName: detail.clientName,
          isPreset: detail.isPreset,
          mode: detail.mode,
          difficultyLevel: detail.difficultyLevel,
          totalRounds: detail.totalRounds,
          phaseLabels: phaseLabelsForCall(null, detail.isPreset),
          voiceAgent: DEFAULT_VOICE_AGENT_SETTINGS,
        });
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
      setFlow((prev) => closeBuilder(prev));
      showToast("Escenario guardado. Selecciónalo e inicia la llamada.", "success");
    },
    [showToast],
  );

  if (loading) {
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

  const compactShell = flow.view === "call";
  const showScorecard =
    (flow.view === "results" || flow.view === "detail") && config;

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
      activeTab={shellTabFromView(flow.view)}
      onTabChange={handleTabChange}
      onSignOut={session ? () => void signOut() : undefined}
      compact={compactShell}
    >
      <ScreenTransition screenKey={flow.view}>
        {(flow.view === "home" || flow.view === "history") && (
          <HistoryView
            refreshKey={historyRefresh}
            traineeId={traineeId}
            traineeEmail={traineeEmail}
            onStartTraining={() => handleTabChange("train")}
            onOpenCall={(id) => void handleOpenCall(id)}
          />
        )}

        {flow.view === "train" && (
          <ScenarioHub
            refreshKey={scenarioRefresh}
            selectedSlugOnLoad={selectedSlugOnLoad}
            isStarting={isStarting}
            onStart={(c) => void handleStart(c)}
            onCreateScenario={() => {
              setBuilderScenario(null);
              setFlow((prev) => openBuilder(prev));
            }}
            onEditScenario={(scenario) => {
              setBuilderScenario(scenario);
              setFlow((prev) => openBuilder(prev));
            }}
          />
        )}

        {flow.view === "builder" && (
          <ScenarioBuilderScreen
            initialScenario={builderScenario}
            onCancel={() => {
              setBuilderScenario(null);
              setFlow((prev) => closeBuilder(prev));
            }}
            onSave={({ scenario }) => handleScenarioSaved(scenario.slug)}
          />
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
            onViewHistory={handleGoHome}
            historyActionLabel="Volver al inicio"
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
