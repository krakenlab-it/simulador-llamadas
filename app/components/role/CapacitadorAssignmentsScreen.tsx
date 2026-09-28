"use client";

import { useEffect, useId, useState } from "react";
import { listScenarios } from "@/lib/api/client";
import {
  isScenarioActiveForPractice,
  isScenarioPublishedToLibrary,
  type ScenarioRecord,
} from "@/lib/scenarios/types";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Spinner } from "@/app/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  applyCvParseToProfile,
  displayNameFromProfile,
  extractTextFromCvFile,
  normalizeAgentProfile,
  parseCvFieldsFromText,
  readAgentCvExtract,
  storeAgentCvExtract,
  type AgentProfile,
} from "@/lib/frontend/agent-profile";
import {
  activeProject,
  assignmentForAgent,
  readTrainingOffice,
  upsertAssignment,
  writeTrainingOffice,
  type AgentAssignment,
  type TrainingOfficeState,
} from "@/lib/frontend/training-office";

interface CapacitadorAssignmentsScreenProps {
  children?: React.ReactNode;
}

function emptyProfile(email: string): AgentProfile {
  return normalizeAgentProfile({
    firstName: "",
    lastName: "",
    age: null,
    email,
    phone: "",
  });
}

export function CapacitadorAssignmentsScreen({
  children,
}: CapacitadorAssignmentsScreenProps) {
  const formId = useId();
  const cvInputId = useId();
  const { showToast } = useToast();
  const [office, setOffice] = useState<TrainingOfficeState>(() => readTrainingOffice());
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cvBusy, setCvBusy] = useState(false);
  const [profile, setProfile] = useState<AgentProfile>(() =>
    emptyProfile("agente@demo.local"),
  );
  const [required, setRequired] = useState(5);
  const [showGrades, setShowGrades] = useState(true);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const project = activeProject(office, "capacitador");

  useEffect(() => {
    const seeded = assignmentForAgent(office, project.id, "agente@demo.local");
    if (seeded) loadAssignmentIntoForm(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial demo agent only
  }, []);

  useEffect(() => {
    setLoading(true);
    void listScenarios()
      .then((rows) => {
        const library = rows.filter(
          (s) =>
            !s.isPreset &&
            isScenarioActiveForPractice(s) &&
            isScenarioPublishedToLibrary(s),
        );
        setScenarios(library);
        setSelectedSlugs(library.slice(0, 3).map((s) => s.slug));
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = (next: TrainingOfficeState) => {
    setOffice(next);
    writeTrainingOffice(next);
  };

  const loadAssignmentIntoForm = (assignment: AgentAssignment) => {
    setEditingId(assignment.id);
    setProfile(normalizeAgentProfile(assignment.profile));
    setRequired(assignment.requiredSimulations);
    setShowGrades(assignment.showGradesToAgent);
    setSelectedSlugs(assignment.scenarioSlugs);
  };

  const syncFromEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    const existing = assignmentForAgent(office, project.id, trimmed);
    if (existing) {
      loadAssignmentIntoForm(existing);
      return;
    }
    setEditingId(null);
    setProfile(emptyProfile(trimmed));
  };

  const saveAssignment = () => {
    const normalized = normalizeAgentProfile({
      ...profile,
      email: profile.email || "agente@demo.local",
    });
    if (!normalized.email) {
      showToast("El correo es obligatorio — es la llave de acceso del agente.", "error");
      return;
    }
    const next = upsertAssignment(office, {
      id: editingId ?? undefined,
      projectId: project.id,
      agentEmail: normalized.email,
      agentDisplayName: displayNameFromProfile(normalized),
      profile: normalized,
      scenarioSlugs: selectedSlugs,
      requiredSimulations: Math.max(1, Math.min(10, required)),
      showGradesToAgent: showGrades,
    });
    persist(next);
    setEditingId(next.assignments.find(
      (a) =>
        a.projectId === project.id &&
        a.agentEmail.toLowerCase() === normalized.email.toLowerCase(),
    )?.id ?? null);
    showToast("Perfil y asignación guardados.", "success");
  };

  const handleCvUpload = async (file: File | null) => {
    if (!file) return;
    setCvBusy(true);
    try {
      const text = await extractTextFromCvFile(file);
      storeAgentCvExtract(profile.email || file.name, text);
      const parsed = applyCvParseToProfile(profile, parseCvFieldsFromText(text));
      const withMeta = {
        ...parsed,
        cvFileName: file.name,
        cvUploadedAt: new Date().toISOString(),
      };
      setProfile(normalizeAgentProfile(withMeta));
      showToast(
        "CV cargado. Revisa los campos autocompletados antes de guardar.",
        "success",
      );
    } catch {
      showToast("No se pudo leer el CV. Prueba un .txt o un PDF con texto.", "error");
    } finally {
      setCvBusy(false);
    }
  };

  const toggleSlug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const existing = office.assignments.filter((a) => a.projectId === project.id);

  return (
    <div className="role-assignments">
      <header className="page-hero page-hero--compact">
        <p className="page-hero__eyebrow">Capacitador · Agentes</p>
        <h1 className="page-hero__title">Asigna escenarios y cupo</h1>
        <p className="page-hero__subtitle">
          Registra el perfil del agente (CV opcional), asigna escenarios publicados en la
          biblioteca y define cuántas simulaciones debe completar. El correo sigue siendo su
          llave de acceso en la demo.
        </p>
      </header>

      <Card className="role-assignments__form">
        <h2 className="config-panel__title">Nueva o actualizar asignación</h2>

        <div className="role-assignments__cv">
          <label className="config-panel__label" htmlFor={cvInputId}>
            CV del agente (PDF, Word o texto)
          </label>
          <input
            id={cvInputId}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,application/pdf,text/plain"
            disabled={cvBusy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleCvUpload(file);
              event.target.value = "";
            }}
          />
          {profile.cvFileName ? (
            <p className="config-panel__hint">
              Archivo: <strong>{profile.cvFileName}</strong>
              {profile.cvUploadedAt
                ? ` · subido ${new Date(profile.cvUploadedAt).toLocaleString("es-MX")}`
                : null}
            </p>
          ) : (
            <p className="config-panel__hint">
              Sube un CV para autocompletar nombre, correo y teléfono cuando el texto sea
              legible.
            </p>
          )}
        </div>

        <div className="role-assignments__grid role-assignments__grid--profile">
          <label className="config-panel__label" htmlFor={`${formId}-first`}>
            Nombre
          </label>
          <input
            id={`${formId}-first`}
            className="config-panel__input"
            value={profile.firstName}
            onChange={(e) =>
              setProfile((p) => ({ ...p, firstName: e.target.value }))
            }
          />
          <label className="config-panel__label" htmlFor={`${formId}-last`}>
            Apellido
          </label>
          <input
            id={`${formId}-last`}
            className="config-panel__input"
            value={profile.lastName}
            onChange={(e) =>
              setProfile((p) => ({ ...p, lastName: e.target.value }))
            }
          />
          <label className="config-panel__label" htmlFor={`${formId}-age`}>
            Edad
          </label>
          <input
            id={`${formId}-age`}
            type="number"
            min={16}
            max={99}
            className="config-panel__input"
            value={profile.age ?? ""}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                age: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
          <label className="config-panel__label" htmlFor={`${formId}-email`}>
            Correo (acceso agente)
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            className="config-panel__input"
            value={profile.email}
            onChange={(e) =>
              setProfile((p) => ({ ...p, email: e.target.value }))
            }
            onBlur={(e) => syncFromEmail(e.target.value)}
          />
          <label className="config-panel__label" htmlFor={`${formId}-phone`}>
            Teléfono
          </label>
          <input
            id={`${formId}-phone`}
            type="tel"
            className="config-panel__input"
            value={profile.phone}
            onChange={(e) =>
              setProfile((p) => ({ ...p, phone: e.target.value }))
            }
          />
          <label className="config-panel__label" htmlFor={`${formId}-quota`}>
            Simulaciones requeridas (1–10)
          </label>
          <input
            id={`${formId}-quota`}
            type="number"
            min={1}
            max={10}
            className="config-panel__input"
            value={required}
            onChange={(e) => setRequired(Number(e.target.value))}
          />
        </div>

        <label className="config-panel__label">
          Escenarios de la biblioteca (publicados)
        </label>
        {loading ? (
          <Spinner label="Cargando escenarios…" />
        ) : scenarios.length === 0 ? (
          <p className="config-panel__hint">
            No hay escenarios publicados en la biblioteca. Crea y publica casos en
            Escenarios antes de asignar.
          </p>
        ) : (
          <ul className="role-assignments__checks">
            {scenarios.map((s) => (
              <li key={s.slug}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedSlugs.includes(s.slug)}
                    onChange={() => toggleSlug(s.slug)}
                  />
                  {s.clientName}
                </label>
              </li>
            ))}
          </ul>
        )}

        <label className="role-assignments__toggle">
          <input
            type="checkbox"
            checked={showGrades}
            onChange={(e) => setShowGrades(e.target.checked)}
          />
          El agente puede ver calificaciones y métricas
        </label>

        <Button onClick={saveAssignment}>Guardar asignación</Button>
      </Card>

      {existing.length > 0 ? (
        <Card>
          <h2 className="config-panel__title">Perfiles en {project.name}</h2>
          <ul className="role-assignments__profiles">
            {existing.map((a) => {
              const cvPreview = readAgentCvExtract(a.agentEmail);
              return (
                <li key={a.id} className="role-assignments__profile-card">
                  <div className="role-assignments__profile-head">
                    <strong>
                      {displayNameFromProfile(a.profile, a.agentDisplayName)}
                    </strong>
                    <span className="role-assignments__profile-meta">
                      {a.agentEmail}
                      {a.profile.age != null ? ` · ${a.profile.age} años` : ""}
                      {a.profile.phone ? ` · ${a.profile.phone}` : ""}
                    </span>
                  </div>
                  <p className="config-panel__hint">
                    {a.scenarioSlugs.length} escenario(s) · cupo {a.requiredSimulations}
                    {a.profile.cvFileName ? ` · CV: ${a.profile.cvFileName}` : ""}
                    {a.showGradesToAgent ? "" : " · notas ocultas al agente"}
                  </p>
                  {cvPreview ? (
                    <p className="role-assignments__cv-preview">
                      {cvPreview.slice(0, 220)}
                      {cvPreview.length > 220 ? "…" : ""}
                    </p>
                  ) : null}
                  <Button
                    variant="ghost"
                    onClick={() => loadAssignmentIntoForm(a)}
                  >
                    Editar perfil
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {children}
    </div>
  );
}
