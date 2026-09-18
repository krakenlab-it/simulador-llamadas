"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentSettingsPanel } from "@/app/components/agent/AgentSettingsPanel";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
  createScenario,
  getAgentHarness,
  listScenarios,
  runAgentChat,
} from "@/lib/api/client";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent/settings";
import {
  readStoredAgentSettings,
  writeStoredAgentSettings,
} from "@/lib/agent/storage";
import { summarizeScenario } from "@/lib/agent/types";
import type {
  AgentChatMessage,
  AgentChatResponse,
  AgentHarnessSettings,
  AgentProviderAvailability,
  PublicScenarioSummary,
} from "@/lib/agent/types";
import { useDocumentLang } from "@/lib/a11y/document-lang";
import { listCatalogPresets } from "@/lib/scenarios/catalog-presets";
import {
  draftToCreateInput,
  validateAuthoringDraft,
  type ScenarioAuthoringDraft,
} from "@/lib/scenarios/authoring";
import {
  listExamplePacks,
  type ExamplePack,
} from "@/lib/scenarios/example-packs";

interface AgentHarnessScreenProps {
  onScenarioSaved: (slug: string) => void;
  onPracticePreset: (slug: string) => void;
}

export function AgentHarnessScreen({
  onScenarioSaved,
  onPracticePreset,
}: AgentHarnessScreenProps) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AgentHarnessSettings>(
    DEFAULT_AGENT_SETTINGS,
  );
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState<ScenarioAuthoringDraft | null>(null);
  const [catalog, setCatalog] = useState<PublicScenarioSummary[]>([]);
  const [availability, setAvailability] =
    useState<AgentProviderAvailability | null>(null);
  const [lastResponse, setLastResponse] = useState<AgentChatResponse | null>(
    null,
  );
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingExample, setSavingExample] = useState(false);

  useEffect(() => {
    setSettings(readStoredAgentSettings(window.localStorage));
    setHydrated(true);
    void getAgentHarness().then((payload) => {
      setAvailability(payload.availability);
    });
    void listScenarios().then((scenarios) => {
      setCatalog(scenarios.map(summarizeScenario));
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredAgentSettings(window.localStorage, settings);
  }, [hydrated, settings]);

  const presets = useMemo(() => listCatalogPresets(), []);
  const examplePacks = useMemo(() => listExamplePacks(), []);
  useDocumentLang(settings.voiceAgent.language);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const nextMessages: AgentChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setComposer("");
    setBusy(true);
    try {
      const response = await runAgentChat({
        messages: nextMessages,
        settings,
        catalog,
        draft,
      });
      setLastResponse(response);
      setDraft(response.draft);
      setMessages([...nextMessages, response.assistantMessage]);
      if (response.appliedInput) {
        const saved = await createScenario(response.appliedInput);
        onScenarioSaved(saved.slug);
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo hablar con el agente.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!lastResponse && !draft) return;
    setSaving(true);
    try {
      const response = await runAgentChat({
        messages: [
          ...messages,
          { role: "user", content: "guárdalo" },
        ],
        settings,
        catalog,
        draft,
      });
      setLastResponse(response);
      setDraft(response.draft);
      if (response.appliedInput) {
        const saved = await createScenario(response.appliedInput);
        onScenarioSaved(saved.slug);
        return;
      }
      showToast("El borrador aún no está listo para guardar.", "error");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo guardar.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const loadExample = (pack: ExamplePack) => {
    setDraft(pack.draft);
    setMessages([
      {
        role: "assistant",
        content: `Cargué ${pack.label}: ${pack.draft.clientName}. Revisa el pack y guárdalo, o práctica un caso de la clínica.`,
      },
    ]);
  };

  const saveExample = async () => {
    if (!draft) return;
    const invalid = validateAuthoringDraft(draft);
    if (invalid) {
      showToast(invalid, "error");
      return;
    }
    setSavingExample(true);
    try {
      const saved = await createScenario(draftToCreateInput(draft));
      onScenarioSaved(saved.slug);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo guardar el ejemplo.",
        "error",
      );
    } finally {
      setSavingExample(false);
    }
  };

  return (
    <div className="agent-harness">
      <header className="page-hero">
        <p className="page-hero__eyebrow">Arranque guiado</p>
        <h1 className="page-hero__title">Arma el escenario o practica ya</h1>
        <p className="page-hero__subtitle">
          Tres pasos: elige un caso listo o un ejemplo (Kraken Flow, Me We,
          Wellness), revisa tono y si el cliente vive, practica. Luego compara
          al equipo. Camino feliz: Vercel AI Gateway → DeepSeek.
        </p>
      </header>

      <ol className="agent-onboarding" aria-label="Cómo empezar">
        <li>Elige un caso de la clínica o un ejemplo</li>
        <li>Revisa tono e idioma — el pack ya viene armado</li>
        <li>Practica y compara al equipo en el mismo examen</li>
      </ol>

      <section className="agent-prefilled" aria-labelledby="agent-prefilled-title">
        <h2 id="agent-prefilled-title">Clínica — listos para llamar</h2>
        {presets.map((preset) => (
          <Card key={preset.slug} className="agent-prefilled__card">
            <h3>{preset.name}</h3>
            <p>
              {preset.title} · {preset.company}
            </p>
            <p>{preset.practiceBrief}</p>
            <Button onClick={() => onPracticePreset(preset.slug)}>
              Practicar {preset.name}
            </Button>
          </Card>
        ))}
      </section>

      <section className="agent-examples" aria-labelledby="agent-examples-title">
        <h2 id="agent-examples-title">Ejemplos para armar</h2>
        <p className="agent-settings__hint">
          Lo que Jaime usa para probar al equipo: Kraken Flow, Me We, Wellness y
          Global Green. Se guardan como caso propio — no tocan la clínica de
          tres.
        </p>
        <div className="agent-prefilled">
          {examplePacks.map((pack) => (
            <Card key={pack.id} className="agent-prefilled__card">
              <p className="agent-examples__label">{pack.label}</p>
              <h3>{pack.draft.clientName}</h3>
              <p>
                {pack.draft.clientTitle} · {pack.draft.companyContext}
              </p>
              <p>{pack.practiceBrief}</p>
              <Button onClick={() => loadExample(pack)}>
                Cargar {pack.label}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <div className="agent-harness__grid">
        <section className="agent-chat" aria-labelledby="agent-chat-title">
          <h2 id="agent-chat-title">Nuevo caso</h2>
          <div className="agent-chat__log">
            {messages.length === 0 ? (
              <p className="agent-chat__empty">
                Ejemplo: «Crea un gerente de banco que no quiere pauta digital».
                Sin Gateway el backend arma el caso en local.
              </p>
            ) : (
              messages.map((message, index) => (
                <p
                  key={`${message.role}-${index}`}
                  className={`agent-bubble agent-bubble--${message.role}`}
                >
                  {message.content}
                </p>
              ))
            )}
          </div>
          <form
            className="agent-chat__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send(composer);
            }}
          >
            <label className="visually-hidden" htmlFor="agent-composer">
              Mensaje para el agente
            </label>
            <textarea
              id="agent-composer"
              rows={3}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(composer);
                }
              }}
              placeholder="Describe el comprador en una frase"
            />
            <Button type="submit" variant="primary" loading={busy}>
              Enviar
            </Button>
          </form>

          {draft ? (
            <Card className="agent-draft">
              <h3>Borrador propuesto</h3>
              <p>
                <strong>{draft.clientName}</strong> · {draft.clientTitle}
              </p>
              <p>
                {draft.industry} — {draft.clientProblem}
              </p>
              <p>
                Éxito: {draft.winCriteria}
              </p>
              <div className="team-actions">
                <Button
                  variant="primary"
                  loading={savingExample}
                  onClick={() => void saveExample()}
                >
                  Guardar y practicar
                </Button>
                <Button
                  loading={saving}
                  onClick={() => void saveDraft()}
                >
                  Guardar escenario
                </Button>
              </div>
            </Card>
          ) : null}

          {settings.visibility.showTraces && lastResponse ? (
            <pre className="agent-traces">
              {lastResponse.traces.map((trace) => trace.toolId).join(", ")}
            </pre>
          ) : null}
          {settings.visibility.showContext && lastResponse ? (
            <pre className="agent-context">{lastResponse.contextPack}</pre>
          ) : null}
        </section>

        <AgentSettingsPanel
          settings={settings}
          availability={availability}
          onChange={setSettings}
        />
      </div>
    </div>
  );
}
