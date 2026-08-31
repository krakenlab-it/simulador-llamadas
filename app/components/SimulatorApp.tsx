"use client";

import { useCallback, useState } from "react";
import { createSession, endSession } from "@/lib/api/client";
import type { EndSessionResponse, TurnSummary } from "@/lib/api/client";
import { SetupScreen, type SetupConfig } from "@/app/components/SetupScreen";
import { LiveCallScreen } from "@/app/components/LiveCallScreen";
import { EvaluationScreen } from "@/app/components/EvaluationScreen";

type Screen = "setup" | "call" | "evaluation";

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

  const handleStart = useCallback(async (setup: SetupConfig) => {
    setStarting(true);
    try {
      const session = await createSession({
        scenarioSlug: setup.client.slug,
        mode: setup.mode,
        difficultyLevel: setup.difficultyLevel,
      });
      setCallAttemptId(session.callAttemptId);
      setConfig(setup);
      setScreen("call");
    } finally {
      setStarting(false);
    }
  }, []);

  const handleHangUp = useCallback(
    async (turns: TurnSummary[]) => {
      if (!callAttemptId) {
        return;
      }
      const result = await endSession(callAttemptId);
      setEvaluation({ result, turns });
      setScreen("evaluation");
    },
    [callAttemptId],
  );

  const handleRepeat = useCallback(async () => {
    if (!config) {
      return;
    }
    setEvaluation(null);
    await handleStart(config);
  }, [config, handleStart]);

  const handleOtherClient = useCallback(() => {
    setCallAttemptId(null);
    setConfig(null);
    setEvaluation(null);
    setScreen("setup");
  }, []);

  return (
    <div className="wrap">
      <p className="kicker">Formación comercial · Módulo 3 · Clínica en vivo</p>
      <h1>Clínica de Citas · Simulador de llamada</h1>
      <p className="subtitle">
        Practica tu llamada en frío. Elige cliente, modo y nivel. Cinco rondas.
        Gana solo si cierras con día y hora concretos.
      </p>

      {starting && <p className="note">Marcando…</p>}

      {screen === "setup" && !starting && (
        <SetupScreen onStart={(c) => void handleStart(c)} />
      )}

      {screen === "call" && callAttemptId && config && (
        <LiveCallScreen
          callAttemptId={callAttemptId}
          client={config.client}
          mode={config.mode}
          level={config.difficultyLevel}
          onHangUp={(turns) => void handleHangUp(turns)}
        />
      )}

      {screen === "evaluation" && evaluation && config && (
        <EvaluationScreen
          result={evaluation.result}
          turns={evaluation.turns}
          clientName={config.client.name}
          onRepeat={() => void handleRepeat()}
          onOtherClient={handleOtherClient}
        />
      )}
    </div>
  );
}
