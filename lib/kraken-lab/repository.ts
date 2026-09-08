import type { Client } from "pg";
import { ScenarioRepository } from "@/lib/scenarios/repository";
import type { CreateCustomScenarioInput } from "@/lib/scenarios/types";
import { buildKrakenScenario } from "./generator";
import type {
  GeneratedKrakenScenario,
  KrakenLabCohortConfig,
  SaveCohortResult,
  StartKrakenSessionResult,
} from "./types";
import { isValidCohort } from "./validation";

interface CohortRow {
  id: string;
  config: KrakenLabCohortConfig;
  created_at: string;
}

function parseCohortConfig(raw: unknown): KrakenLabCohortConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as KrakenLabCohortConfig;
  if (!value.project || !value.sessionSeed) return null;
  return value;
}

export class KrakenLabRepository {
  constructor(private readonly client: Client) {}

  async saveCohort(config: KrakenLabCohortConfig): Promise<SaveCohortResult> {
    if (!isValidCohort(config)) {
      throw new Error("Configuración de cohorte incompleta");
    }

    const { rows } = await this.client.query<CohortRow>(
      `INSERT INTO kraken_lab_cohorts (config)
       VALUES ($1::jsonb)
       RETURNING id, config, created_at`,
      [JSON.stringify(config)],
    );

    const row = rows[0];
    const saved: KrakenLabCohortConfig = {
      ...config,
      id: row.id,
      createdAt: row.created_at,
    };

    return { cohortId: row.id, config: saved };
  }

  async getCohort(id: string): Promise<KrakenLabCohortConfig | null> {
    const { rows } = await this.client.query<CohortRow>(
      `SELECT id, config, created_at FROM kraken_lab_cohorts WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const parsed = parseCohortConfig(rows[0].config);
    if (!parsed) return null;
    return { ...parsed, id: rows[0].id, createdAt: rows[0].created_at };
  }

  async createScenarioFromCohort(
    cohort: KrakenLabCohortConfig,
    traineeId?: string,
  ): Promise<{ scenarioId: string; generated: GeneratedKrakenScenario }> {
    const generated = buildKrakenScenario(cohort);
    const input: CreateCustomScenarioInput = {
      industry: generated.config.industry,
      productSold: generated.config.productSold,
      clientName: generated.clientName,
      clientTitle: generated.clientTitle,
      companyContext: generated.companyContext,
      temperament: generated.config.temperament,
      difficultyLabel: generated.difficultyLabel,
      clientProblem: generated.config.clientProblem,
      objections: generated.config.objections,
      winCriteria: generated.config.winCriteria,
      language: "es",
      callType: generated.config.callType,
      rounds: generated.config.rounds,
      traineeId,
    };

    const scenarioRepo = new ScenarioRepository(this.client);
    const created = await scenarioRepo.createCustom(input);

    await this.client.query(
      `UPDATE scenarios SET config = $2::jsonb WHERE id = $1`,
      [
        created.id,
        JSON.stringify({
          ...created.config,
          krakenLab: generated.config.krakenLab,
        }),
      ],
    );

    return {
      scenarioId: created.id,
      generated: { ...generated, slug: created.slug },
    };
  }

  async linkCohortToScenario(cohortId: string, scenarioId: string): Promise<void> {
    await this.client.query(
      `UPDATE kraken_lab_cohorts SET scenario_id = $2 WHERE id = $1`,
      [cohortId, scenarioId],
    );
  }

  async linkCohortToCall(cohortId: string, callAttemptId: string): Promise<void> {
    await this.client.query(
      `UPDATE kraken_lab_cohorts SET call_attempt_id = $2 WHERE id = $1`,
      [cohortId, callAttemptId],
    );
  }
}

export type { StartKrakenSessionResult };

export async function startKrakenLabSession(
  client: Client,
  input: {
    cohort: KrakenLabCohortConfig;
    traineeId: string;
    mode: "voz" | "texto";
  },
): Promise<StartKrakenSessionResult> {
  const repo = new KrakenLabRepository(client);
  const { SessionService } = await import("@/lib/session/service");

  let cohort = input.cohort;
  if (!cohort.id) {
    const saved = await repo.saveCohort(cohort);
    cohort = saved.config;
  }

  const { scenarioId, generated } = await repo.createScenarioFromCohort(
    cohort,
    input.traineeId,
  );

  if (cohort.id) {
    await repo.linkCohortToScenario(cohort.id, scenarioId);
  }

  const service = new SessionService(client);
  const session = await service.startSession({
    traineeId: input.traineeId,
    scenarioSlug: generated.slug,
    difficultyLevel: cohort.difficultyLevel,
    mode: input.mode,
  });

  if (cohort.id) {
    await repo.linkCohortToCall(cohort.id, session.callAttemptId);
  }

  return {
    cohortId: cohort.id ?? "",
    callAttemptId: session.callAttemptId,
    traineeId: session.traineeId,
    scenarioSlug: generated.slug,
    clientName: generated.clientName,
    totalRounds: session.totalRounds,
    config: generated.config,
  };
}
