import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";
import { resolve } from "node:path";

const sourcePath = process.argv
  .find((a) => a.startsWith("--source="))
  ?.slice(9);
if (!sourcePath)
  throw Error(
    "Provide --source=/absolute/path/restorecart.sqlite. Default is a read-only inventory; --apply copies to an empty external database.",
  );
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
source.exec("BEGIN"); // Consistent read-only snapshot; pause source writes before the final cutover.
const tables = source
  .prepare(
    "SELECT name,sql FROM sqlite_master WHERE type='table' AND name GLOB 'rc_*' ORDER BY name",
  )
  .all() as { name: string; sql: string }[];
if (!tables.length) throw Error("Source contains no RestoreCart tables.");
for (const table of tables)
  if (!/^rc_[a-z0-9_]+$/.test(table.name))
    throw Error("Unsupported table name.");
const inventory = tables.map((t) => ({
  table: t.name,
  rows: Number(source.prepare(`SELECT count(*) n FROM "${t.name}"`).get()?.n),
}));
console.log(
  JSON.stringify({
    mode: process.argv.includes("--apply")
      ? "copy-to-empty-database"
      : "read-only-inventory",
    tables: inventory,
  }),
);
if (process.argv.includes("--apply")) {
  const url = process.env.TURSO_DATABASE_URL,
    authToken = process.env.TURSO_AUTH_TOKEN;
  const localTest = process.env.NODE_ENV === "test" && url?.startsWith("file:");
  if (!url || (!localTest && (!/^(libsql|https):\/\//.test(url) || !authToken)))
    throw Error(
      "Configure a secure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN privately.",
    );
  const target = createClient({ url, authToken });
  let transaction;
  try {
    for (const table of tables)
      await target.execute(
        table.sql.replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS "),
      );
    transaction = await target.transaction("write");
    for (const table of tables) {
      const result = await transaction.execute(
        `SELECT count(*) n FROM "${table.name}"`,
      );
      if (Number(result.rows[0].n))
        throw Error(
          "Destination already contains data. Migration refused; use a fresh database. Nothing was overwritten.",
        );
    }
    for (const table of tables) {
      const rows = source.prepare(`SELECT * FROM "${table.name}"`).all();
      const columns = (
        source.prepare(`PRAGMA table_info("${table.name}")`).all() as any[]
      ).map((c) => c.name as string);
      if (columns.some((c) => !/^[a-z0-9_]+$/i.test(c)))
        throw Error("Unsupported column name.");
      for (const row of rows)
        await transaction.execute({
          sql: `INSERT INTO "${table.name}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
          args: columns.map((c) => row[c]) as any[],
        });
      const count = (
        await transaction.execute(`SELECT count(*) n FROM "${table.name}"`)
      ).rows[0].n;
      if (Number(count) !== rows.length)
        throw Error("Migration count mismatch; rolling back.");
    }
    await transaction.commit();
    transaction = undefined;
    console.log(
      "Migration committed. Source unchanged. Configure the service to use this database, then verify accounts, receipts and recovery history.",
    );
  } catch {
    if (transaction) await transaction.rollback();
    throw Error(
      "Migration did not complete. Inspect the destination before retrying; source was not changed.",
    );
  } finally {
    target.close();
  }
}
source.close();
