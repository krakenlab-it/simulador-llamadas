import { useEffect } from "react";
import type { AgentLanguage } from "@/lib/voice/agent-settings";

export function htmlLangForVoice(language: AgentLanguage): "es" | "en" {
  switch (language) {
    case "es":
      return "es";
    case "en":
      return "en";
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

/** Sets <html lang> for the English voice path; restores Spanish on leave. */
export function useDocumentLang(language: AgentLanguage): void {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang || "es";
    root.lang = htmlLangForVoice(language);
    return () => {
      root.lang = previous;
    };
  }, [language]);
}
