/**
 * Live-call audio device selection (speaker via setSinkId, mic via getUserMedia).
 * Persists choices in localStorage for the next call on this browser.
 */

export const CALL_SPEAKER_STORAGE_KEY = "simulador:callSpeakerId";
export const CALL_MIC_STORAGE_KEY = "simulador:callMicId";

export interface CallAudioDevice {
  deviceId: string;
  label: string;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

export function loadStoredDeviceId(key: string): string | null {
  if (!canUseLocalStorage()) return null;
  const value = localStorage.getItem(key)?.trim();
  return value || null;
}

export function storeDeviceId(key: string, deviceId: string): void {
  if (!canUseLocalStorage() || !deviceId) return;
  localStorage.setItem(key, deviceId);
}

export function supportsSpeakerSelection(): boolean {
  if (typeof window === "undefined") return false;
  const audio = document.createElement("audio");
  return typeof audio.setSinkId === "function";
}

export function deviceLabel(
  device: MediaDeviceInfo,
  fallback: string,
): string {
  const trimmed = device.label?.trim();
  return trimmed || fallback;
}

export async function requestCallDevicePermission(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

export async function listCallAudioDevices(): Promise<{
  inputs: CallAudioDevice[];
  outputs: CallAudioDevice[];
}> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs: CallAudioDevice[] = [];
  const outputs: CallAudioDevice[] = [];

  devices.forEach((device, index) => {
    if (device.kind === "audioinput") {
      inputs.push({
        deviceId: device.deviceId,
        label: deviceLabel(device, `Micrófono ${inputs.length + 1 || index + 1}`),
      });
      return;
    }
    if (device.kind === "audiooutput") {
      outputs.push({
        deviceId: device.deviceId,
        label: deviceLabel(device, `Altavoz ${outputs.length + 1 || index + 1}`),
      });
    }
  });

  return { inputs, outputs };
}

export async function openMicCaptureStream(
  deviceId?: string | null,
): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia_unavailable");
  }

  const constraints: MediaStreamConstraints = deviceId
    ? { audio: { deviceId: { exact: deviceId } } }
    : { audio: true };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    if (!deviceId) throw new Error("mic_permission_denied");
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}
