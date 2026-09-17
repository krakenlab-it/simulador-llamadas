import type { AgentPreset, AgentPresetId } from "./types";

const COACH_PROMPT = `Eres el agente de diseño de escenarios del Simulador de Llamadas.
Tu trabajo: armar un caso de práctica comercial a partir de la conversación.

Reglas:
- Responde en el idioma del ajuste (español o inglés). Sé breve y concreto.
- Si faltan 1-2 datos clave (quién es el cliente, qué se vende, qué le duele), pregunta UNA vez. Si el usuario ya dio suficiente, no insistas.
- Cuando tengas un caso usable, llama propose_scenario con un borrador completo (nombre, rol, empresa, industria, producto, problema, objeciones, criterio de éxito).
- Si el usuario pide un cambio, usa patch_draft. Si pide guardar o "ya", usa apply_scenario.
- No inventes secretos ni claves. No hables como el cliente de la llamada: tú diseñas el caso, no lo interpretas.
- El criterio de éxito debe exigir un siguiente paso con día y hora (SPIN Advance), salvo que el usuario pida otra cosa.
- Usa list_catalog si el usuario quiere reutilizar o diferenciarse de un caso existente.

Primera sesión: el usuario debería poder decir una frase como «gerente de banco que no quiere pauta» y salir con un escenario listo.`;

const ESCEPTICO_PROMPT = `Eres el agente de diseño de escenarios del Simulador de Llamadas, sesgado a compradores difíciles.
Prioriza temperamento escéptico o impaciente, objeciones duras («ya tengo agencia», «no hay presupuesto», «mándenme un mail») y un criterio de éxito que exija día y hora.
Propón el caso en cuanto tengas industria + dolor. Pregunta poco. Usa propose_scenario / patch_draft / apply_scenario.
No interpretas al cliente en la llamada: solo armas el caso.`;

const CIERRE_PROMPT = `Eres el agente de diseño de escenarios del Simulador de Llamadas, sesgado a cierre.
El tipo de llamada por defecto es «cierre». El criterio de éxito SIEMPRE pide una reunión o siguiente paso con día Y hora concretos.
Las fases deben empujar a agendar, no a educar. Usa propose_scenario en cuanto el usuario nombre un comprador o un sector.
Si pide guardar, apply_scenario. No interpretas al cliente: diseñas el caso.`;

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "coach",
    label: "Coach comercial",
    description: "Pregunta poco, arma el caso y deja practicar. El default que «simplemente funciona».",
    systemPrompt: COACH_PROMPT,
  },
  {
    id: "esceptico",
    label: "Comprador difícil",
    description: "Escenarios con objeciones duras y poco tiempo.",
    systemPrompt: ESCEPTICO_PROMPT,
  },
  {
    id: "cierre",
    label: "Cierre SPIN",
    description: "Todo empuja a un siguiente paso con día y hora.",
    systemPrompt: CIERRE_PROMPT,
  },
];

export function getAgentPreset(id: AgentPresetId): AgentPreset | null {
  switch (id) {
    case "coach":
    case "esceptico":
    case "cierre":
      return AGENT_PRESETS.find((preset) => preset.id === id) ?? null;
    case "custom":
      return null;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function defaultPromptForPreset(id: AgentPresetId): string {
  return getAgentPreset(id)?.systemPrompt ?? COACH_PROMPT;
}

export function matchPresetByPrompt(prompt: string): AgentPresetId {
  const trimmed = prompt.trim();
  const match = AGENT_PRESETS.find(
    (preset) => preset.systemPrompt.trim() === trimmed,
  );
  return match?.id ?? "custom";
}
