"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentSettingsPanel } from "@/app/components/agent/AgentSettingsPanel";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Spinner } from "@/app/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  createScenario,
  getAgentHarness,
  listScenarios,
  runAgentChat,
} from "@/lib/api/client";
import { parseAgentHarnessSettings } from "@/lib/agent/settings";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent/settings";
import {
  readStoredAgentSettings,
  writeStoredAgentSettings,
} from "@/lib/agent/storage";
import { summarizeScenario } from "@/lib/agent/types";
import { buildVisibilityView } from "@/lib/agent/visibility";
import type {
  AgentChatMessage,
  AgentChatResponse,
  AgentHarnessSettings,
  PublicScenarioSummary,
} from "@/lib/agent/types";
import {
  draftToCreateInput,
  validateAuthoringDraft,
  type ScenarioAuthoringDraft,
} from "@/lib/scenarios/authoring";

interface AgentHarnessScreenProps {
  onScenarioSaved: (slug: string) => void;
}

function nextMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentHarnessScreen({ onScenarioSaved }: AgentHarnessScreenProps) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AgentHarnessSettings>(
    DEFAULT_AGENT_SETTINGS,
  );
  const [hydrated, setHydrated] = useState(false);
  const [catalog, setCatalog] = useState<PublicScenarioSummary[]>([]);
  const [availability, setAvailability] = useState({
    groq: false,
    gemini: false,
    gateway: false,
  });
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState<ScenarioAuthoringDraft | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastResponse, setLastResponse] = useState<AgentChatResponse | null>(
    null,
  );

  useEffect(() => {
    setSettings(readStoredAgentSettings(window.localStorage));
    setHydrated(true);
    void getAgentHarness()
      .then((catalogPayload) => {
        setAvailability(catalogPayload.availability);
      })
      .catch(() => {
        /* defaults already render */
      });
    void listScenarios()
      .then((rows) => setCatalog(rows.map(summarizeScenario)))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredAgentSettings(window.localStorage, settings);
  }, [settings, hydrated]);

  const visibility = useMemo(
    () =>
      buildVisibilityView({
        settings,
        contextPack: lastResponse?.contextPack ?? "",
        traces: lastResponse?.traces ?? [],
        draft,
      }),
    [settings, lastResponse, draft],
  );

  const canSave = draft ? validateAuthoringDraft(draft) === null : false;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMessage: AgentChatMessage = {
      id: nextMessageId(),
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const response = await runAgentChat({
        messages: nextMessages,
        settings: parseAgentHarnessSettings(settings),
        catalog,
        draft,
      });
      setLastResponse(response);
      setMessages([...nextMessages, response.assistantMessage]);
      setDraft(response.draft);
      if (response.appliedInput) {
        setSaving(true);
        try {
          const saved = await createScenario(response.appliedInput);
          showToast("El agente guardó el escenario.", "success");
          onScenarioSaved(saved.slug);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "El borrador está listo, pero no se pudo guardar.";
          showToast(message, "error");
        } finally {
          setSaving(false);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo hablar con el agente.";
      showToast(message, "error");
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !canSave || saving) return;
    setSaving(true);
    try {
      const saved = await createScenario(draftToCreateInput(draft));
      showToast("Escenario guardado.", "success");
      onScenarioSaved(saved.slug);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="agent-harness">
      <header className="page-hero">
        <p className="page-hero__eyebrow">Agente · Vercel AI SDK</p>
        <h1 className="page-hero__title">Arma el escenario en conversación</h1>
        <p className="page-hero__subtitle">
          Cuéntale el comprador. El agente propone el caso con tools. Todos los
          knobs —incluido el system prompt— viven en Ajustes.
        </p>
      </header>

      <div className="agent-harness__grid">
        <section className="agent-chat" aria-label="Conversación con el agente">
          <div className="agent-chat__log" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <p className="agent-chat__empty">
                Prueba: «Crea un gerente de banco que no quiere pauta digital».
                Sin clave de modelo, el fallback local igual arma un caso usable.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`agent-bubble agent-bubble--${message.role}`}
                >
                  <p>{message.content}</p>
                </div>
              ))
            )}
            {sending ? (
              <div className="agent-chat__pending">
                <Spinner label="El agente está armando el caso…" />
              </div>
            ) : null}
          </div>

          <form
            className="agent-chat__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <label className="visually-hidden" htmlFor="agent-chat-input">
              Mensaje para el agente
            </label>
            <textarea
              id="agent-chat-input"
              className="agent-chat__input"
              rows={3}
              value={input}
              placeholder="Describe el cliente, el sector o el dolor…"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button
              variant="primary"
              type="submit"
              disabled={!input.trim()}
              loading={sending}
            >
              Enviar
            </Button>
          </form>

          {draft ? (
            <Card className="agent-draft">
              <div className="agent-draft__head">
                <h3>Borrador propuesto</h3>
                <span className="chip chip--custom">
                  {draft.callType} · {draft.language}
                </span>
              </div>
              <p>
                <strong>{draft.clientName || "Sin nombre"}</strong>
                {draft.clientTitle ? ` · ${draft.clientTitle}` : ""}
              </p>
              <p className="agent-draft__meta">
                {draft.industry || "Industria pendiente"} · vende{" "}
                {draft.productSold || "—"}
              </p>
              <p className="agent-draft__meta">
                Dolor: {draft.clientProblem || "—"}
              </p>
              <p className="agent-draft__meta">Éxito: {draft.winCriteria}</p>
              <Button
                variant="primary"
                disabled={!canSave}
                loading={saving}
                onClick={() => void handleSave()}
              >
                Guardar escenario
              </Button>
              {!canSave ? (
                <p className="config-panel__hint">
                  Completa nombre, rol, empresa, industria, producto, dolor y
                  criterio de éxito — o sigue la conversación.
                </p>
              ) : null}
            </Card>
          ) : null}

          {visibility.showTools ||
          visibility.showContext ||
          visibility.showTraces ? (
            <div className="agent-visibility" aria-label="Visibilidad de tuning">
              {visibility.showTools ? (
                <section>
                  <h3>Herramientas activas</h3>
                  <p>{visibility.enabledToolLabels.join(" · ")}</p>
                </section>
              ) : null}
              {visibility.showContext ? (
                <section>
                  <h3>Contexto empaquetado</h3>
                  <pre className="agent-visibility__pre">
                    {visibility.contextPack || "(vacío)"}
                  </pre>
                </section>
              ) : null}
              {visibility.showTraces ? (
                <section>
                  <h3>Trazas</h3>
                  {visibility.traces.length === 0 ? (
                    <p>Aún no hay tools en este turno.</p>
                  ) : (
                    <ul>
                      {visibility.traces.map((trace, index) => (
                        <li key={`${trace.toolId}-${index}`}>
                          <strong>{trace.toolId}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </div>
          ) : null}
        </section>

        <AgentSettingsPanel
          value={settings}
          onChange={setSettings}
          availability={availability}
        />
      </div>
    </div>
  );
}
