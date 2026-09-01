import { describe, expect, it } from "vitest";
import { withPgClient } from "@/lib/session";

const databaseUrl = process.env.DATABASE_URL;

const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("withPgClient pool (integration)", () => {
  it("reuses the pool across consecutive calls without connect errors", async () => {
    const first = await withPgClient((client) =>
      client.query<{ one: number }>("SELECT 1 AS one"),
    );
    const second = await withPgClient((client) =>
      client.query<{ one: number }>("SELECT 1 AS one"),
    );

    expect(first.rows[0]?.one).toBe(1);
    expect(second.rows[0]?.one).toBe(1);
  });
});
