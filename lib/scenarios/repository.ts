import type { Client } from "pg";
import { buildScenarioConfig, slugifyScenario } from "./defaults";
import type {
  CreateCustomScenarioInput,
  ScenarioConfig,
  ScenarioRecord,
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
  config: ScenarioConfig;
}

function mapRow(row: ScenarioRow): ScenarioRecord {
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
    config: row.config ?? ({} as ScenarioConfig),
  };
}

export class ScenarioRepository {
  constructor(private readonly client: Client) {}

  async listScenarios(): Promise<ScenarioRecord[]> {
    const { rows } = await this.client.query<ScenarioRow>(
      `SELECT
         id, slug, is_preset, client_name, client_title, company_context,
         difficulty_label, indicator, pain_points, industry, product_sold,
         temperament, client_problem, objections, win_criteria, config
       FROM scenarios
       ORDER BY is_preset DESC, sort_order NULLS LAST, created_at DESC`,
    );
    return rows.map(mapRow);
  }

  async getBySlug(slug: string): Promise<ScenarioRecord | null> {
    const { rows } = await this.client.query<ScenarioRow>(
      `SELECT
         id, slug, is_preset, client_name, client_title, company_context,
         difficulty_label, indicator, pain_points, industry, product_sold,
         temperament, client_problem, objections, win_criteria, config
       FROM scenarios WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async createCustom(input: CreateCustomScenarioInput): Promise<ScenarioRecord> {
    const config = buildScenarioConfig({
      industry: input.industry,
      productSold: input.productSold,
      clientProblem: input.clientProblem,
      objections: input.objections,
      winCriteria: input.winCriteria,
      temperament: input.temperament,
      clientName: input.clientName,
    });

    const slug = slugifyScenario(input.clientName, input.industry);
    const painPoints = [input.clientProblem, ...input.objections].filter(Boolean);

    const { rows } = await this.client.query<ScenarioRow>(
      `INSERT INTO scenarios (
         slug, client_name, client_title, company_context,
         difficulty_label, indicator, pain_points,
         is_preset, industry, product_sold, temperament,
         client_problem, objections, win_criteria, config,
         created_by_trainee_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
       RETURNING
         id, slug, is_preset, client_name, client_title, company_context,
         difficulty_label, indicator, pain_points, industry, product_sold,
         temperament, client_problem, objections, win_criteria, config`,
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
        JSON.stringify(config),
        input.traineeId ?? null,
      ],
    );

    return mapRow(rows[0]);
  }
}
