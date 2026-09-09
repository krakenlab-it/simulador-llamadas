"use client";

import { useRef } from "react";
import { Button } from "@/app/components/ui/Button";
import {
  applyParsedCvToProfile,
  parseCvFile,
} from "@/lib/kraken-lab/cv-parse";
import type { PasanteProfile } from "@/lib/kraken-lab/types";

interface ParticipantCvUploadProps {
  profile: PasanteProfile;
  onProfileChange: (next: PasanteProfile) => void;
  onToast: (message: string, tone: "info" | "success" | "error") => void;
}

export function ParticipantCvUpload({
  profile,
  onProfileChange,
  onToast,
}: ParticipantCvUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    try {
      const { parsed, limited, text } = await parseCvFile(file);
      const next = applyParsedCvToProfile(profile, parsed, file.name);
      onProfileChange(next);

      const filledCount = [
        parsed.fullName,
        parsed.email,
        parsed.phone,
        parsed.city,
        parsed.age,
      ].filter(Boolean).length;

      if (filledCount > 0) {
        onToast(
          limited
            ? "Perfil completado desde el CV. Revisa o completa los campos."
            : "Perfil completado desde el CV.",
          limited ? "info" : "success",
        );
      } else if (text) {
        onToast("Revisa o completa los campos manualmente.", "info");
      } else {
        onToast(
          "No se pudo extraer texto del CV. Prueba con .txt o .md.",
          "info",
        );
      }
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "No se pudo leer el CV.",
        "error",
      );
    }
  };

  return (
    <div className="participant-cv-upload">
      <input
        ref={fileInputRef}
        type="file"
        className="scenario-context-upload__input"
        accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(event) => {
          void handleFile(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        className="scenario-context-upload__add"
        aria-label="Subir CV"
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="scenario-context-upload__plus" aria-hidden="true">
          +
        </span>
        Subir CV
      </Button>

      {profile.cvFileName ? (
        <div className="scenario-context-upload__file participant-cv-upload__file">
          <span className="scenario-context-upload__file-name">{profile.cvFileName}</span>
          <button
            type="button"
            className="scenario-context-upload__remove"
            onClick={() =>
              onProfileChange({
                ...profile,
                cvFileName: undefined,
              })
            }
          >
            Quitar
          </button>
        </div>
      ) : (
        <p className="config-panel__hint participant-cv-upload__hint">
          .txt, .md, .pdf, .docx · opcional
        </p>
      )}
    </div>
  );
}
