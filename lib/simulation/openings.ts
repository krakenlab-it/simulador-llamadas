import type { ClientPersona } from "@/lib/clients";
import { pickVariedLine } from "./session-variation";

/** ≥3 opening variants per Clínica persona; identity fixed, wording varies per session. */
export const CLINIC_OPENING_BANKS: Record<string, readonly string[]> = {
  mariana: [
    "¿Quién habla? Estoy entre juntas.",
    "Ya tenemos agencia y caseta. No busco otra cosa.",
    "Tengo un minuto. Si no es visitas a caseta, cierro.",
    "Mariana Escobedo. Dígame rápido qué quiere.",
  ],
  rodrigo: [
    "Tengo dos minutos. ¿Qué tiene que ver con tráfico a tienda?",
    "Si es otro discurso de branding, cuelgo.",
    "Rodrigo Nava. Hable de venta por m² o no pierda mi tiempo.",
    "¿Otra llamada de medios? Sea concreto con tráfico a tienda.",
  ],
  efrain: [
    "El piso está flojo. No me interesan los clics.",
    "¿Ustedes miden gente real o solo leads?",
    "Efraín Loera. Si no trae gente al piso, no me sirve.",
    "El lote está vacío. Convénzame de que no es puro clic.",
  ],
};

export function getClinicOpeningPool(client: ClientPersona): readonly string[] {
  const bank = CLINIC_OPENING_BANKS[client.slug];
  if (bank && bank.length >= 3) return bank;
  return client.openings;
}

export function getClinicOpeningLine(
  client: ClientPersona,
  sessionSeed: string,
  priorClientLines?: readonly string[],
): string {
  return pickVariedLine(getClinicOpeningPool(client), {
    sessionSeed,
    salt: "opening",
    priorClientLines,
  });
}
