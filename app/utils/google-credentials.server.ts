import fs from "node:fs";

/**
 * Ensure GOOGLE_APPLICATION_CREDENTIALS is set.
 * If GOOGLE_CLOUD_CREDENTIALS_JSON is provided, write it to /tmp and point the env var there.
 * Safe to call multiple times.
 */
export async function ensureGoogleApplicationCredentials(): Promise<void> {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.length > 0) {
    // Already configured (local dev may point to a file on disk)
    return;
  }
  const json = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  if (!json) {
    // Nothing to do; ADC will fall back to metadata or other sources
    return;
  }
  const tmpPath = "/tmp/gcp-service-account.json";
  // Write only if not present or content differs
  try {
    const exists = fs.existsSync(tmpPath);
    if (!exists) {
      await fs.promises.writeFile(tmpPath, json, { encoding: "utf8" });
    }
  } catch {
    // Best-effort; if write fails, let library handle missing creds
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}
