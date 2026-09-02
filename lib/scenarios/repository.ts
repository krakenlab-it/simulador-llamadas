import type { Client } from "pg";
import {
  parseVoiceAgentSettings,
  type VoiceAgentSettings,
} from "@/lib/voice/agent-settings";
import {
  buildAuthoredScenarioConfig,
  normalizeAuthoringLanguage,
} from "./authoring";
import { slugifyScenario } from "./defaults";
import type {
  CreateCustomScenarioInput,
  ScenarioConfig,
  ScenarioLanguage,
  ScenarioRecord,
  UpdateCustomScenarioInput,
} from "./types";

interface ScenarioRow {
  id: string;
  slug: string;
  is_preset: boolean;
  client_name: string;
  client_title: string;
  company_context: string;
  difficulty_label: string;
  indicator: string;
  pain_points: string[];
  industry: string | null;
  product_sold: string | null;
  temperament: string | null;
  client_problem: string | null;
  objections: string[];
  win_criteria: string | null;
  language: string | null;
  config: ScenarioConfig;
  voice_agent?: unknown;
}

const SCENARIO_SELECT = `
  id, slug, is_preset, client_name, client_title, company_context,
  difficulty_label, indicator, pain_points, industry, product_sold,
  temperament, client_problem, objections, win_criteria, language, config, voice_agent
`;

function mapRow(row: ScenarioRow): ScenarioRecord {
  const language = normalizeAuthoringLanguage(row.language ?? row.config?.language);
  return {
    id: row.id,
    slug: row.slug,
    isPreset: row.is_preset,
    clientName: row.client_name,
    clientTitle: row.client_title,
    companyContext: row.company_context,
    difficultyLabel: row.difficulty_label,
    indicator: row.indicator,
    painPoints: row.pain_points,
    industry: row.industry,
    productSold: row.product_sold,
    temperament: row.temperament,
    clientProblem: row.client_problem,
    objections: row.objections ?? [],
    winCriteria: row.win_criteria,
    language,
    config: {
      ...(row.config ?? ({} as ScenarioConfig)),
      language: row.config?.language ?? language,
    },
    voiceAgent: parseVoiceAgentSettings(row.voice_agent),
  };
}

function authoredFields(input: CreateCustomScenarioInput): {
  config: ScenarioConfig;
  language: ScenarioLanguage;
  painPoints: string[];
} {
  const config = buildAuthoredScenarioConfig(input);
  return {
    config,
    language: normalizeAuthoringLanguage(input.language ?? config.language),
    painPoints: [input.clientProblem, ...input.objections].filter(Boolean),
  };
}

export class ScenarioNotFoundError extends Error {
  constructor(slug: string) {
    super(`Scenario not found: ${slug}`);
    this.name = "ScenarioNotFoundError";
  }
}

export class PresetScenarioLockedError extends Error {
  constructor(slug: string) {
    super(`Clinic presets cannot be edited: ${slug}`);
    this.name = "PresetScenarioLockedError";
  }
}

export class ScenarioRepository {
  constructor(private readonly client: Client) {}

  async listScenarios(): Promise<ScenarioRecord[]> {
    const { rows } = await this.client.query<ScenarioRow>(
      `SELECT ${SCENARIO_SELECT}
       FROM scenarios
       ORDER BY is_preset DESC, sort_order NULLS LAST, created_at DESC`,
    );
    return rows.map(mapRow);
  }

  async getBySlug(slug: string): Promise<ScenarioRecord | null> {
    const { rows } = await this.client.query<ScenarioRow>(
      `SELECT ${SCENARIO_SELECT} FROM scenarios WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async createCustom(input: CreateCustomScenarioInput): Promise<ScenarioRecord> {
    const { config, language, painPoints } = authoredFields(input);
    const slug = slugifyScenario(input.clientName, input.industry);

    const { rows } = await this.client.query<ScenarioRow>(
      `INSERT INTO scenarios (
         slug, client_name, client_title, company_context,
         difficulty_label, indicator, pain_points,
         is_preset, industry, product_sold, temperament,
         client_problem, objections, win_criteria, language, config,
         created_by_trainee_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16)
       RETURNING ${SCENARIO_SELECT}`,
      [
        slug,
        input.clientName,
        input.clientTitle,
        input.companyContext,
        input.difficultyLabel,
        input.winCriteria.slice(0, 80),
        painPoints,
        input.industry,
        input.productSold,
        input.temperament,
        input.clientProblem,
        input.objections,
        input.winCriteria,
        language,
        JSON.stringify(config),
        input.traineeId ?? null,
      ],
    );

    return mapRow(rows[0]);
  }

  async updateVoiceAgent(
    slug: string,
    settings: VoiceAgentSettings,
  ): Promise<ScenarioRecord | null> {
    const voiceAgent = parseVoiceAgentSettings(settings);
    const { rows } = await this.client.query<ScenarioRow>(
      `UPDATE scenarios
          SET voice_agent = $2::jsonb
        WHERE slug = $1
        RETURNING ${SCENARIO_SELECT}`,
      [slug, JSON.stringify(voiceAgent)],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async updateCustom(input: UpdateCustomScenarioInput): Promise<ScenarioRecord> {
    const existing = await this.getBySlug(input.slug);
    if (!existing) {
      throw new ScenarioNotFoundError(input.slug);
    }
    if (existing.isPreset) {
      throw new PresetScenarioLockedError(input.slug);
    }

    const { config, language, painPoints } = authoredFields(input);

    const { rows } = await this.client.query<ScenarioRow>(
      `UPDATE scenarios SET
         client_name = $2,
         client_title = $3,
         company_context = $4,
         difficulty_label = $5,
         indicator = $6,
         pain_points = $7,
         industry = $8,
         product_sold = $9,
         temperament = $10,
         client_problem = $11,
         objections = $12,
         win_criteria = $13,
         language = $14,
         config = $15::jsonb
       WHERE slug = $1 AND is_preset = false
       RETURNING ${SCENARIO_SELECT}`,
      [
        input.slug,
        input.clientName,
        input.clientTitle,
        input.companyContext,
        input.difficultyLabel,
        input.winCriteria.slice(0, 80),
        painPoints,
        input.industry,
        input.productSold,
        input.temperament,
        input.clientProblem,
        input.objections,
        input.winCriteria,
        language,
        JSON.stringify(config),
      ],
    );

    if (!rows[0]) {
      throw new PresetScenarioLockedError(input.slug);
    }

    return mapRow(rows[0]);
  }
}
