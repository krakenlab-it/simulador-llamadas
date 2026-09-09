"use client";

import { useId, useRef } from "react";
import {
  appendScenarioContextFile,
  extractTextFromScenarioFile,
  removeScenarioContextFile,
} from "@/lib/kraken-lab/scenario-context";
import {
  countScenarioContextFiles,
  savedFilesBannerMessage,
} from "@/lib/kraken-lab/context-from-industry";
import type { KrakenLabProject, ScenarioContextUpload } from "@/lib/kraken-lab/types";
import { Button } from "@/app/components/ui/Button";

interface ScenarioContextUploadPanelProps {
  value: ScenarioContextUpload | undefined;
  activeProject?: KrakenLabProject;
  uploading?: boolean;
  onChange: (next: ScenarioContextUpload, forProject?: KrakenLabProject) => void;
  onToast: (message: string, tone: "info" | "success" | "error") => void;
}

export function ScenarioContextUploadPanel({
  value,
  activeProject,
  uploading = false,
  onChange,
  onToast,
}: ScenarioContextUploadPanelProps) {
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const context = value ?? { text: "" };
  const files = context.files ?? [];
  const fileCount = countScenarioContextFiles(context);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const scopedProject = activeProject;
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

    onChange(current, scopedProject);

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
            onChange(
              {
                ...context,
                text: event.target.value,
              },
              activeProject,
            )
          }
          placeholder="Ej. Vendemos Kraken Flow a importadoras: pedidos urgentes se atascan entre ventas y almacén. Objeciones: ya tenemos ERP, no queremos otra captura…"
        />
      </label>

      {fileCount > 0 ? (
        <div className="scenario-context-upload__saved-files">
          <p
            className="scenario-context-upload__saved-banner"
            role="status"
            aria-live="polite"
          >
            {savedFilesBannerMessage(fileCount)}
          </p>
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
                  onClick={() =>
                    onChange(removeScenarioContextFile(context, file.id), activeProject)
                  }
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
    </div>
  );
}
