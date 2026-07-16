import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Minimal zero-dependency `.env` loader.
 *
 * The suite is designed to run with the committed defaults in `capabilities.ts`,
 * so a `.env` file is entirely optional — it only exists so a reviewer can point
 * the suite at a different device/account/package without editing source.
 * We parse it by hand rather than pulling in `dotenv` to keep the dependency
 * surface small and auditable.
 */
function loadDotEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, '..', '.env');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf-8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    // Real environment variables always win over the file.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

/** Read an env var, falling back to a default. Empty string counts as "unset". */
export function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}
