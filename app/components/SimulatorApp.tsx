"use client";

import { useCallback, useMemo, useState } from "react";
import {
  createSession,
  endSession,
  type EndSessionResponse,
  type TurnSummary,
} from "@/lib/api/client";
import { appendLocalHistory } from "@/lib/history/local";
import { sessionToShellUser } from "@/lib/frontend/auth-shell";
import {
  beginStarting,
  closeBuilder,
  enterCall,
  enterResults,
  initialFlowState,
  navigate,
  openBuilder,
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

interface EvaluationState {
  result: EndSessionResponse;
  turns: TurnSummary[];
}

function shellTabFromView(view: AppView): ShellTab {
  return view === "history" ? "history" : "train";
}

function SimulatorShell() {
  const { session, loading, signOut } = useAuth();
  const { showToast } = useToast();
  const [textOnly, setTextOnly] = useState(false);
  const [flow, setFlow] = useState<FlowState>(initialFlowState);
  const [callAttemptId, setCallAttemptId] = useState<string | null>(null);
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationState | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [scenarioRefresh, setScenarioRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [selectedSlugOnLoad, setSelectedSlugOnLoad] = useState<string | null>(
    null,
  );

  const shellUser = useMemo(
    () => (session?.user ? sessionToShellUser(session.user) : null),
    [session],
  );

  const isStarting = flow.phase === "starting";

  const handleTabChange = useCallback((tab: ShellTab) => {
    const target: AppView = tab === "history" ? "history" : "train";
    setFlow((prev) => navigate(prev, target));
  }, []);

  const handleStart = useCallback(
    async (setup: SetupConfig) => {
      setFlow((prev) => beginStarting(prev));
      try {
        const created = await createSession({
          scenarioSlug: setup.scenarioSlug,
          mode: setup.mode,
          difficultyLevel: setup.difficultyLevel,
        });
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
    [showToast],
  );

  const handleHangUp = useCallback(
    async (turns: TurnSummary[]) => {
      if (!callAttemptId || !config || ending) return;
      setEvaluating(true);
      setEnding(true);
      setFlow(() => enterResults());
      try {
        const result = await endSession(callAttemptId);
        appendLocalHistory({
          callAttemptId,
          scenarioSlug: config.scenarioSlug,
          clientName: config.clientName,
          difficultyLevel: config.difficultyLevel,
          mode: config.mode,
          won: result.won,
          totalScore: result.totalScore,
          turnsCompleted: result.turnsCompleted,
          startedAt: callStartedAt ?? new Date().toISOString(),
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
        {flow.view === "train" && (
          <ScenarioHub
            refreshKey={scenarioRefresh}
            selectedSlugOnLoad={selectedSlugOnLoad}
            isStarting={isStarting}
            onStart={(c) => void handleStart(c)}
            onCreateScenario={() => setFlow((prev) => openBuilder(prev))}
          />
        )}

        {flow.view === "history" && (
          <HistoryView
            refreshKey={historyRefresh}
            onStartTraining={() => handleTabChange("train")}
          />
        )}

        {flow.view === "builder" && (
          <ScenarioBuilderScreen
            onCancel={() => setFlow((prev) => closeBuilder(prev))}
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
            verifiedUserId={config.verifiedUserId}
            ending={ending}
            onHangUp={(turns) => void handleHangUp(turns)}
          />
        )}

        {flow.view === "results" && config && (
          <ResultsScreen
            result={evaluation?.result ?? null}
            turns={evaluation?.turns ?? []}
            clientName={config.clientName}
            scenarioSlug={config.scenarioSlug}
            totalRounds={config.totalRounds}
            loading={evaluating}
            onRepeat={() => void handleRepeat()}
            onNewScenario={handleNewScenario}
            onViewHistory={() => handleTabChange("history")}
          />
        )}
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
