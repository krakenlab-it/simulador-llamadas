"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CALL_MIC_STORAGE_KEY,
  CALL_SPEAKER_STORAGE_KEY,
  listCallAudioDevices,
  loadStoredDeviceId,
  openMicCaptureStream,
  requestCallDevicePermission,
  storeDeviceId,
  supportsSpeakerSelection,
  type CallAudioDevice,
} from "@/lib/voice/call-devices";
import { applyCallSpeaker, unlockClientPlayback } from "@/lib/voice/client-playback";

export interface UseCallAudioDevicesResult {
  ready: boolean;
  speakerSupported: boolean;
  inputs: CallAudioDevice[];
  outputs: CallAudioDevice[];
  selectedMicId: string;
  selectedSpeakerId: string;
  micCaptureNote: string | null;
  refreshDevices: () => Promise<void>;
  selectMic: (deviceId: string) => Promise<void>;
  selectSpeaker: (deviceId: string) => Promise<void>;
  releaseMic: () => void;
}

const BROWSER_STT_MIC_NOTE =
  "El reconocimiento de voz del navegador puede seguir usando el micrófono predeterminado del sistema.";

export function useCallAudioDevices(
  enabled: boolean,
  browserSttPath: boolean,
): UseCallAudioDevicesResult {
  const [ready, setReady] = useState(false);
  const [inputs, setInputs] = useState<CallAudioDevice[]>([]);
  const [outputs, setOutputs] = useState<CallAudioDevice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCaptureGenerationRef = useRef(0);

  const stopMicStream = useCallback(() => {
    micCaptureGenerationRef.current += 1;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  }, []);

  const holdMicStream = useCallback(async (deviceId: string) => {
    stopMicStream();
    if (!deviceId) return;
    const generation = micCaptureGenerationRef.current;
    const stream = await openMicCaptureStream(deviceId);
    if (generation !== micCaptureGenerationRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    micStreamRef.current = stream;
  }, [stopMicStream]);

  const refreshDevices = useCallback(async () => {
    if (!enabled) return;
    unlockClientPlayback();
    await requestCallDevicePermission();
    const listed = await listCallAudioDevices();
    setInputs(listed.inputs);
    setOutputs(listed.outputs);

    const storedMic = loadStoredDeviceId(CALL_MIC_STORAGE_KEY);
    const storedSpeaker = loadStoredDeviceId(CALL_SPEAKER_STORAGE_KEY);

    const micId =
      storedMic && listed.inputs.some((device) => device.deviceId === storedMic)
        ? storedMic
        : listed.inputs[0]?.deviceId ?? "";
    const speakerId =
      storedSpeaker &&
      listed.outputs.some((device) => device.deviceId === storedSpeaker)
        ? storedSpeaker
        : listed.outputs[0]?.deviceId ?? "";

    setSelectedMicId(micId);
    setSelectedSpeakerId(speakerId);
    setReady(true);

    if (speakerId) {
      await applyCallSpeaker(speakerId);
    }
    if (micId) {
      await holdMicStream(micId);
    }
  }, [enabled, holdMicStream]);

  useEffect(() => {
    if (!enabled) {
      stopMicStream();
      setReady(false);
      return;
    }
    void refreshDevices();
    return stopMicStream;
  }, [enabled, refreshDevices, stopMicStream]);

  const selectMic = useCallback(
    async (deviceId: string) => {
      setSelectedMicId(deviceId);
      storeDeviceId(CALL_MIC_STORAGE_KEY, deviceId);
      unlockClientPlayback();
      await holdMicStream(deviceId);
    },
    [holdMicStream],
  );

  const selectSpeaker = useCallback(async (deviceId: string) => {
    setSelectedSpeakerId(deviceId);
    storeDeviceId(CALL_SPEAKER_STORAGE_KEY, deviceId);
    unlockClientPlayback();
    await applyCallSpeaker(deviceId);
  }, []);

  return {
    ready,
    speakerSupported: supportsSpeakerSelection(),
    inputs,
    outputs,
    selectedMicId,
    selectedSpeakerId,
    micCaptureNote: browserSttPath ? BROWSER_STT_MIC_NOTE : null,
    refreshDevices,
    selectMic,
    selectSpeaker,
    releaseMic: stopMicStream,
  };
}
