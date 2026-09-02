export interface TurnSubmitLog {
  event: "voice.turn.submit";
  callAttemptId: string;
  roundNumber?: number;
  turnId?: string;
  clientTurnId?: string | null;
  httpStatus: number;
  code?: string;
}

export function logTurnSubmit(payload: Omit<TurnSubmitLog, "event">): void {
  console.info(JSON.stringify({ event: "voice.turn.submit", ...payload }));
}
