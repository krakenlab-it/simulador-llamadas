import { beforeEach, describe, expect, it } from "vitest";
import {
  resetStubSessions,
  stubCreateSession,
  stubEndSession,
  stubGetSessionDetail,
  stubListHistory,
  stubSubmitTurn,
} from "@/lib/api/stubs";
import { enterDetail, initialFlowState, navigate } from "@/lib/frontend/flow";
import { formatHistoryEntries } from "@/lib/frontend/format-history";

describe("dashboard list + detail stub round-trip", () => {
  beforeEach(() => {
    resetStubSessions();
  });

  it("lists a scored session and opens the same persisted scorecard", async () => {
    const flow = navigate(initialFlowState(), "train");
    expect(flow.view).toBe("train");

    const session = stubCreateSession({
      scenarioSlug: "efrain",
      mode: "texto",
      difficultyLevel: 2,
      traineeEmail: "seb@example.com",
      traineeDisplayName: "Sebastian",
    });

    await stubSubmitTurn(session.callAttemptId, {
      utterance: "Entiendo el problema de medición. ¿Qué le cuesta más hoy?",
    });
    const ended = await stubEndSession(session.callAttemptId);
    expect(ended.evaluation.scorecard).toBeDefined();

    const history = stubListHistory(undefined, "seb@example.com");
    expect(history).toHaveLength(1);
    expect(history[0].callAttemptId).toBe(session.callAttemptId);
    expect(history[0].totalScore).toBe(ended.totalScore);
    expect(history[0].turnsCompleted).toBe(1);

    const rows = formatHistoryEntries(history);
    expect(rows[0].clientName).toBe("Efraín Loera");
    expect(rows[0].scoreLabel).toBe(`${ended.totalScore}/100`);

    const detail = stubGetSessionDetail(session.callAttemptId);
    expect(detail.evaluation?.scorecard?.overallScore).toBe(ended.totalScore);
    expect(detail.evaluation?.nextDrill).toBe(ended.evaluation.nextDrill);
    expect(detail.turns).toHaveLength(1);

    const opened = enterDetail();
    expect(opened.view).toBe("detail");
  });
});
