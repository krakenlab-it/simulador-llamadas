const TRAINEE_ID_KEY = "clinicav2:traineeId";

export function getStoredTraineeId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(TRAINEE_ID_KEY);
}

export function storeTraineeId(traineeId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(TRAINEE_ID_KEY, traineeId);
}
