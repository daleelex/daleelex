import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve(process.cwd(), '.env');

if (existsSync(ENV_FILE)) {
  const lines = readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = unquote(trimmed.slice(separator + 1).trim());

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
