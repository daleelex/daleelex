/**
 * How often to repeat a run, from INGEST_INTERVAL_MINUTES.
 *
 * Null means "run once and exit", which is what a developer, CI and
 * `docker compose run` want. Unset and empty are both null: Compose passes an
 * unset variable through as the empty string.
 *
 * Anything else that is not a positive number throws. A typo should stop the
 * worker at start-up, not quietly turn a scheduled worker into a one-shot.
 */
export function parseIntervalMinutes(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;

  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error(
      `INGEST_INTERVAL_MINUTES must be a positive number of minutes, got "${value}".`,
    );
  }
  return minutes;
}
