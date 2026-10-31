import {
  Worker,
  MessageChannel,
  receiveMessageOnPort,
} from "node:worker_threads";
import type { DatabaseSync } from "node:sqlite";
// Preserve existing synchronous transaction boundaries. Network I/O runs in a dedicated
// worker; each SQL call blocks the server thread. Intended for this low-volume prototype.
// No local replica or fallback is used: acknowledged writes are committed remotely.
export function remoteDatabase(url: string, token?: string) {
  if (
    !/^(libsql|https):\/\//.test(url) &&
    !(process.env.NODE_ENV === "test" && url.startsWith("file:"))
  )
    throw Error(
      "External storage requires a secure libSQL/HTTPS database URL.",
    );
  if (!token && !url.startsWith("file:"))
    throw Error("External storage requires TURSO_AUTH_TOKEN.");
  const channel = new MessageChannel();
  const worker = new Worker(new URL("./libsql-worker.mjs", import.meta.url), {
    workerData: { url, token, port: channel.port2 },
    transferList: [channel.port2],
  });
  worker.unref();
  let closed = false;
  worker.on("error", () => {
    closed = true;
    channel.port1.close();
  });
  function rpc(kind: string, sql = "", args: any[] = []) {
    if (closed)
      throw Error(
        "External database connection is unavailable. Restart after checking storage; no local fallback was used.",
      );
    const signal = new SharedArrayBuffer(4),
      state = new Int32Array(signal);
    channel.port1.postMessage({ kind, sql, args, signal });
    if (Atomics.wait(state, 0, 0, 30000) === "timed-out") {
      closed = true;
      void worker.terminate();
      channel.port1.close();
      throw Error(
        "External database timed out. The outcome may be uncertain; reconnect and reconcile before repeating writes.",
      );
    }
    const response = receiveMessageOnPort(channel.port1)?.message;
    if (!response)
      throw Error(
        "External database returned no acknowledgement; reconcile before retrying.",
      );
    if (response.error) throw Error(response.error);
    return response.result;
  }
  return {
    exec(sql: string) {
      rpc("exec", sql);
    },
    prepare(sql: string) {
      return {
        all(...args: any[]) {
          return rpc("query", sql, args).rows;
        },
        get(...args: any[]) {
          return rpc("query", sql, args).rows[0];
        },
        run(...args: any[]) {
          const result = rpc("query", sql, args);
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          };
        },
      };
    },
    close() {
      if (!closed) {
        try {
          rpc("close");
        } finally {
          closed = true;
          channel.port1.close();
          void worker.terminate();
        }
      }
    },
  } as unknown as DatabaseSync;
}
