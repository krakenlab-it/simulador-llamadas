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
import { SetupScreen, type SetupConfig } from "@/app/components/SetupScreen";
import { ScenarioBuilderScreen } from "@/app/components/ScenarioBuilderScreen";
import { LiveCallScreen } from "@/app/components/LiveCallScreen";
import { EvaluationScreen } from "@/app/components/EvaluationScreen";

type Screen = "setup" | "builder" | "call" | "evaluation";

interface EvaluationState {
  result: EndSessionResponse;
  turns: TurnSummary[];
}

export function SimulatorApp() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [callAttemptId, setCallAttemptId] = useState<string | null>(null);
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationState | null>(null);
  const [starting, setStarting] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [scenarioRefresh, setScenarioRefresh] = useState(0);
  const [selectedSlugOnLoad, setSelectedSlugOnLoad] = useState<string | null>(
    null,
  );

  const handleStart = useCallback(async (setup: SetupConfig) => {
    setStarting(true);
    try {
      const session = await createSession({
        scenarioSlug: setup.scenarioSlug,
        mode: setup.mode,
        difficultyLevel: setup.difficultyLevel,
      });
      setCallAttemptId(session.callAttemptId);
      setCallStartedAt(new Date().toISOString());
      setConfig({
        ...setup,
        totalRounds: session.totalRounds ?? setup.totalRounds,
      });
      setScreen("call");
    } finally {
      setStarting(false);
    }
  }, []);

  const handleHangUp = useCallback(
    async (turns: TurnSummary[]) => {
      if (!callAttemptId || !config) return;
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
    },
    [callAttemptId, config, callStartedAt],
  );

  const handleRepeat = useCallback(async () => {
    if (!config) return;
    setEvaluation(null);
    await handleStart(config);
  }, [config, handleStart]);

  const handleOtherClient = useCallback(() => {
    setCallAttemptId(null);
    setCallStartedAt(null);
    setConfig(null);
    setEvaluation(null);
    setScreen("setup");
  }, []);

  const handleScenarioSaved = useCallback((slug: string) => {
    setScenarioRefresh((k) => k + 1);
    setSelectedSlugOnLoad(slug);
    setScreen("setup");
  }, []);

  return (
    <div className="wrap">
      <header className="site-header">
        <BrandMark />
        <p className="brand-wordmark">
          Simulador de Llamadas <span>· CDC</span>
        </p>
      </header>

      <p className="kicker">Formación comercial · Entrenamiento de ventas con IA</p>
      <h1>Simulador de llamadas de venta</h1>
      <p className="subtitle">
        Practica llamadas en frío para cualquier industria. Cinco rondas por
        defecto. Gana cerrando con día y hora concretos — o tu propio criterio de
        éxito.
      </p>

      {starting && <p className="note">Marcando…</p>}

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
          onRepeat={() => void handleRepeat()}
          onOtherClient={handleOtherClient}
        />
      )}
    </div>
  );
}
