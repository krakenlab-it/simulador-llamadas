import { tool } from "ai";
import { z } from "zod";
import {
  acknowledgeOfferedSlot,
  extractOfferedSlot,
} from "@/lib/agent/client-motor";
import type { BuyerPsychState, BuyerResistanceStyle } from "./buyer-psych";

export const BUYER_TOOL_IDS = [
  "end_call",
  "request_channel",
  "set_resistance",
  "acknowledge_slot",
] as const;
export type BuyerToolId = (typeof BUYER_TOOL_IDS)[number];

export const endCallSchema = z.object({
  reason: z.string().min(1).describe("Por qué cuelga o cierra, en voz del comprador"),
});

export const requestChannelSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
});

export const setResistanceSchema = z.object({
  style: z.enum(["block", "stall"]),
});

export const acknowledgeSlotSchema = z.object({
  day: z.string().min(1),
  time: z.string().min(1),
  stance: z.enum(["accept", "counter", "block"]),
});

export interface BuyerToolResult {
  toolId: BuyerToolId;
  spoken: string;
  next: Partial<BuyerPsychState>;
}

export function applyBuyerTool(
  state: BuyerPsychState,
  toolId: BuyerToolId,
  raw: unknown,
  traineeUtterance = "",
): BuyerToolResult {
  switch (toolId) {
    case "end_call": {
      const parsed = endCallSchema.safeParse(raw);
      const reason = parsed.success ? parsed.data.reason : "Ahora no puedo";
      return {
        toolId,
        spoken: `${reason.replace(/\.*$/, "")}. Adiós.`,
        next: { phase: "closing", hardBlock: true },
      };
    }
    case "request_channel": {
      const parsed = requestChannelSchema.safeParse(raw);
      const channel = parsed.success ? parsed.data.channel : "email";
      return {
        toolId,
        spoken:
          channel === "whatsapp"
            ? "Mándame un WhatsApp. Así no te atiendo en la caseta."
            : "Mándame un correo. Luego lo veo.",
        next: { phase: state.slotOffered ? "schedule_or_exit" : "resist" },
      };
    }
    case "set_resistance": {
      const parsed = setResistanceSchema.safeParse(raw);
      const style: BuyerResistanceStyle = parsed.success
        ? parsed.data.style
        : state.resistanceStyle === "curious_guarded"
          ? "stall"
          : state.resistanceStyle;
      return {
        toolId,
        spoken:
          style === "block"
            ? "Ya tenemos proveedor. No sigo con esto."
            : "La otra semana, a ver si hay hueco.",
        next: { resistanceStyle: style, phase: style === "block" ? "closing" : "resist" },
      };
    }
    case "acknowledge_slot": {
      if (!state.slotOffered) {
        return {
          toolId,
          spoken: "La otra semana, a ver si hay hueco.",
          next: { phase: state.phase },
        };
      }
      const parsed = acknowledgeSlotSchema.safeParse(raw);
      const stance = parsed.success ? parsed.data.stance : "accept";
      const fromTool =
        parsed.success
          ? extractOfferedSlot(`${parsed.data.day} ${parsed.data.time}`)
          : null;
      const slot =
        state.offeredSlot ??
        extractOfferedSlot(traineeUtterance) ??
        fromTool;
      if (!slot) {
        return {
          toolId,
          spoken: "La otra semana, a ver si hay hueco.",
          next: { phase: "schedule_or_exit" },
        };
      }
      if (stance === "block") {
        return {
          toolId,
          spoken: `${slot} no me sirve. Cuelgo.`,
          next: { slotResolved: true, phase: "closing", hardBlock: true },
        };
      }
      if (stance === "counter") {
        return {
          toolId,
          spoken: `${slot} no. Mejor el jueves a las 10.`,
          next: { slotResolved: true, phase: "schedule_or_exit" },
        };
      }
      return {
        toolId,
        spoken: acknowledgeOfferedSlot(slot),
        next: { slotResolved: true, phase: "closing" },
      };
    }
    default: {
      const _exhaustive: never = toolId;
      return _exhaustive;
    }
  }
}

export function createBuyerAiSdkTools(
  state: BuyerPsychState,
  traineeUtterance: string,
  onResult: (result: BuyerToolResult) => void,
) {
  return {
    end_call: tool({
      description: "Cierra o cuelga la llamada como comprador ocupado.",
      inputSchema: endCallSchema,
      execute: async (input) => {
        const result = applyBuyerTool(state, "end_call", input, traineeUtterance);
        onResult(result);
        return result;
      },
    }),
    request_channel: tool({
      description: "Pide correo o WhatsApp en vez de seguir en la llamada.",
      inputSchema: requestChannelSchema,
      execute: async (input) => {
        const result = applyBuyerTool(
          state,
          "request_channel",
          input,
          traineeUtterance,
        );
        onResult(result);
        return result;
      },
    }),
    set_resistance: tool({
      description: "Fija si este turno es block (cortar) o stall (atrasar).",
      inputSchema: setResistanceSchema,
      execute: async (input) => {
        const result = applyBuyerTool(
          state,
          "set_resistance",
          input,
          traineeUtterance,
        );
        onResult(result);
        return result;
      },
    }),
    acknowledge_slot: tool({
      description:
        "Usa esto cuando el vendedor ya dio un día y hora concretos. Nunca finjas que no hubo oferta.",
      inputSchema: acknowledgeSlotSchema,
      execute: async (input) => {
        const result = applyBuyerTool(
          state,
          "acknowledge_slot",
          input,
          traineeUtterance,
        );
        onResult(result);
        return result;
      },
    }),
  };
}

export function buyerToolsPromptHint(): string {
  return [
    "Herramientas de comprador (preférela a «acordarte»):",
    "end_call — cuelgas.",
    "request_channel(email|whatsapp) — stall de canal.",
    "set_resistance(block|stall) — un solo tipo este turno.",
    "acknowledge_slot(day,time,accept|counter|block) — si ya hay día y hora.",
  ].join("\n");
}
