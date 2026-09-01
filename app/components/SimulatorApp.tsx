"use client";

import { useCallback, useState } from "react";
import {
  createSession,
  endSession,
  type EndSessionResponse,
  type TurnSummary,
} from "@/lib/api/client";
import { appendLocalHistory } from "@/lib/history/local";
import { BrandMark } from "@/components/brand/BrandMark";
import { ScreenTransition } from "@/components/ui/ScreenTransition";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { SetupScreen, type SetupConfig } from "@/app/components/SetupScreen";
import { ScenarioBuilderScreen } from "@/app/components/ScenarioBuilderScreen";
import { LiveCallScreen } from "@/app/components/LiveCallScreen";
import { EvaluationScreen } from "@/app/components/EvaluationScreen";
import { AuthScreen } from "@/app/components/AuthScreen";
import { AuthProvider, useAuth } from "@/lib/auth/context";

type Screen = "setup" | "builder" | "call" | "evaluation";

interface EvaluationState {
  result: EndSessionResponse;
  turns: TurnSummary[];
}

function SimulatorShell() {
  const { session, loading, signOut } = useAuth();
  const { showToast } = useToast();
  const [textOnly, setTextOnly] = useState(false);
  const [screen, setScreen] = useState<Screen>("setup");
  const [callAttemptId, setCallAttemptId] = useState<string | null>(null);
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationState | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [scenarioRefresh, setScenarioRefresh] = useState(0);
  const [selectedSlugOnLoad, setSelectedSlugOnLoad] = useState<string | null>(
    null,
  );

  const handleStart = useCallback(
    async (setup: SetupConfig) => {
      setStarting(true);
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
        setScreen("call");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la llamada. Intenta de nuevo.";
        showToast(message, "error");
      } finally {
        setStarting(false);
      }
    },
    [showToast],
  );

  const handleHangUp = useCallback(
    async (turns: TurnSummary[]) => {
      if (!callAttemptId || !config || ending) return;
      setEnding(true);
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
        setScreen("evaluation");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo finalizar la llamada.";
        showToast(message, "error");
      } finally {
        setEnding(false);
      }
    },
    [callAttemptId, config, callStartedAt, ending, showToast],
  );

  const handleRepeat = useCallback(async () => {
    if (!config || starting) return;
    setEvaluation(null);
    await handleStart(config);
  }, [config, handleStart, starting]);

  const handleOtherClient = useCallback(() => {
    setCallAttemptId(null);
    setCallStartedAt(null);
    setConfig(null);
    setEvaluation(null);
    setScreen("setup");
  }, []);

  const handleScenarioSaved = useCallback(
    (slug: string) => {
      setScenarioRefresh((k) => k + 1);
      setSelectedSlugOnLoad(slug);
      setScreen("setup");
      showToast("Escenario guardado. Selecciónalo y pulsa Marcar.", "success");
    },
    [showToast],
  );

  const transitionKey =
    screen === "call" && callAttemptId
      ? `call-${callAttemptId}`
      : screen === "evaluation" && evaluation
        ? `eval-${evaluation.result.callAttemptId}`
        : screen;

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

  return (
    <main>
      <div className="wrap">
        <header className="site-header">
          <BrandMark />
          <p className="brand-wordmark">
            Simulador de Llamadas <span>· CDC</span>
          </p>
          {session?.user.email && (
            <button
              type="button"
              className="auth-signout"
              onClick={() => void signOut()}
            >
              Cerrar sesión ({session.user.email})
            </button>
          )}
        </header>

        <p className="kicker">Formación comercial · Entrenamiento de ventas con IA</p>
        <h1>Simulador de llamadas de venta</h1>
        <p className="subtitle">
          Practica llamadas en frío para cualquier industria. Cinco rondas por
          defecto. Gana cerrando con día y hora concretos — o tu propio criterio de
          éxito.
        </p>

        <div className="screen-content">
          {starting && screen === "setup" && (
            <div className="loading-overlay" role="status" aria-live="polite">
              <Spinner label="Marcando" />
              <span>Marcando…</span>
            </div>
          )}

          <ScreenTransition screenKey={transitionKey}>
            {screen === "setup" && !starting && (
              <SetupScreen
                refreshKey={scenarioRefresh}
                selectedSlugOnLoad={selectedSlugOnLoad}
                onStart={(c) => void handleStart(c)}
                onCreateScenario={() => setScreen("builder")}
              />
            )}

            {screen === "builder" && (
              <ScenarioBuilderScreen
                onCancel={() => setScreen("setup")}
                onSave={({ scenario }) => handleScenarioSaved(scenario.slug)}
              />
            )}

            {screen === "call" && callAttemptId && config && (
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

            {screen === "evaluation" && evaluation && config && (
              <EvaluationScreen
                result={evaluation.result}
                turns={evaluation.turns}
                clientName={config.clientName}
                scenarioSlug={config.scenarioSlug}
                totalRounds={config.totalRounds}
                repeating={starting}
                onRepeat={() => void handleRepeat()}
                onOtherClient={handleOtherClient}
              />
            )}
          </ScreenTransition>
        </div>
      </div>
    </main>
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
