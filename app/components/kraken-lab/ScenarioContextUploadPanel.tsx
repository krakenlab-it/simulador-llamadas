"use client";

import { useId, useRef } from "react";
import {
  appendScenarioContextFile,
  extractTextFromScenarioFile,
  removeScenarioContextFile,
} from "@/lib/kraken-lab/scenario-context";
import type { ScenarioContextUpload } from "@/lib/kraken-lab/types";
import { Button } from "@/app/components/ui/Button";

interface ScenarioContextUploadPanelProps {
  value: ScenarioContextUpload | undefined;
  uploading?: boolean;
  onChange: (next: ScenarioContextUpload) => void;
  onToast: (message: string, tone: "info" | "success" | "error") => void;
}

export function ScenarioContextUploadPanel({
  value,
  uploading = false,
  onChange,
  onToast,
}: ScenarioContextUploadPanelProps) {
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const context = value ?? { text: "" };
  const files = context.files ?? [];

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    let current = context;
    let addedCount = 0;
    let limitedCount = 0;

    for (const file of Array.from(fileList)) {
      try {
        const result = await extractTextFromScenarioFile(file);
        if (result.unsupportedFormat) {
          limitedCount += 1;
          current = appendScenarioContextFile(current, {
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            text: "",
          });
          continue;
        }

        if (!result.text) {
          onToast(`No se encontró texto en ${file.name}.`, "error");
          continue;
        }

        current = appendScenarioContextFile(current, {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          text: result.text,
        });
        addedCount += 1;
      } catch (error) {
        onToast(
          error instanceof Error ? error.message : `No se pudo leer ${file.name}.`,
          "error",
        );
      }
    }

    onChange(current);

    if (addedCount > 0) {
      onToast(
        addedCount === 1
          ? "Documento agregado al contexto."
          : `${addedCount} documentos agregados al contexto.`,
        "success",
      );
    }
    if (limitedCount > 0) {
      onToast(
        "PDF/DOCX: por ahora pega el texto o sube .txt / .md. El archivo quedó listado.",
        "info",
      );
    }
  };

  return (
    <div className="scenario-context-upload">
      <label className="field" htmlFor={textareaId}>
        <span>Brief / producto / objeciones / guion</span>
        <textarea
          id={textareaId}
          rows={6}
          value={context.text}
          onChange={(event) =>
            onChange({
              ...context,
              text: event.target.value,
            })
          }
          placeholder="Ej. Vendemos Kraken Flow a importadoras: pedidos urgentes se atascan entre ventas y almacén. Objeciones: ya tenemos ERP, no queremos otra captura…"
        />
      </label>

      <div className="scenario-context-upload__actions">
        <input
          ref={fileInputRef}
          type="file"
          className="scenario-context-upload__input"
          accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          disabled={uploading}
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="scenario-context-upload__add"
          disabled={uploading}
          aria-label="Subir documento"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="scenario-context-upload__plus" aria-hidden="true">
            +
          </span>
          Subir documento
        </Button>
        <p className="config-panel__hint scenario-context-upload__hint">
          .txt, .md, .pdf, .docx · puedes elegir varios archivos
        </p>
      </div>

      {files.length > 0 ? (
        <ul className="scenario-context-upload__files" aria-label="Documentos cargados">
          {files.map((file) => (
            <li key={file.id} className="scenario-context-upload__file">
              <span className="scenario-context-upload__file-name">{file.name}</span>
              {file.text ? (
                <span className="scenario-context-upload__file-status">Texto agregado</span>
              ) : (
                <span className="scenario-context-upload__file-status scenario-context-upload__file-status--muted">
                  Sin texto extraído
                </span>
              )}
              <button
                type="button"
                className="scenario-context-upload__remove"
                onClick={() => onChange(removeScenarioContextFile(context, file.id))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
