export function storageStatus() {
  const external = !!process.env.TURSO_DATABASE_URL;
  return {
    backend: external ? "external-libsql" : "local-sqlite",
    deploymentMode: external ? "external" : "resettable-demo",
    message: external
      ? "External database configured. Writes use the remote database; hosted restart verification is still required."
      : "Local SQLite. Render Free can lose this data on restart. Configure an external database for persistent hosted records.",
    configured: external,
  };
}
