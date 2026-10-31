import { workerData } from "node:worker_threads";
import { createClient } from "@libsql/client";
const client = createClient({
  url: workerData.url,
  authToken: workerData.token,
});
let transaction;
let queue = Promise.resolve();
workerData.port.on("message", (message) => {
  queue = queue.then(async () => {
    const state = new Int32Array(message.signal);
    try {
      let result;
      const command = message.sql?.trim().replace(/;$/, "").toUpperCase();
      if (message.kind === "close") {
        if (transaction) {
          await transaction.rollback();
          transaction = undefined;
        }
        client.close();
        result = null;
      } else if (message.kind === "exec" && command === "BEGIN IMMEDIATE") {
        if (transaction) throw Error("Nested transaction rejected");
        transaction = await client.transaction("write");
        result = null;
      } else if (
        message.kind === "exec" &&
        ["COMMIT", "ROLLBACK"].includes(command)
      ) {
        if (!transaction) throw Error("No active transaction");
        const current = transaction;
        transaction = undefined;
        if (command === "COMMIT") await current.commit();
        else await current.rollback();
        result = null;
      } else if (message.kind === "exec") {
        await (transaction || client).executeMultiple(message.sql);
        result = null;
      } else {
        const raw = await (transaction || client).execute({
          sql: message.sql,
          args: message.args,
        });
        const rows = raw.rows.map((row) =>
          Object.fromEntries(
            raw.columns.map((name) => [
              name,
              row[name] instanceof ArrayBuffer
                ? Buffer.from(row[name])
                : row[name],
            ]),
          ),
        );
        result = {
          rows,
          changes: raw.rowsAffected,
          lastInsertRowid: raw.lastInsertRowid,
        };
      }
      workerData.port.postMessage({ result });
      Atomics.store(state, 0, 1);
    } catch {
      workerData.port.postMessage({
        error:
          "External database operation failed. Check database availability; do not repeat uncertain payments or recovery writes blindly.",
      });
      Atomics.store(state, 0, 2);
    }
    Atomics.notify(state, 0);
  });
});
