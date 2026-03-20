// ---------------------------------------------------------------------------
// Mutagenix – Time Configuration
// ---------------------------------------------------------------------------
// The "day" advances when the user injects credits, not with real time.
// Mutation applies gradually over MUTATION_DURATION_MS after injection.

const DEV_MODE =
  process.env.NODE_ENV === 'development' ||
  process.env.MUTAGENIX_DEV_TIME === 'true';

export const TIME_CONFIG = {
  /** How long a mutation takes to fully apply after injection. */
  MUTATION_DURATION_MS: DEV_MODE ? 60 * 1000 : 8 * 60 * 60 * 1000, // 60s dev, 8h prod

  /** Minimum cooldown between injections (after mutation completes). */
  COOLDOWN_MS: DEV_MODE ? 10 * 1000 : 60 * 60 * 1000, // 10s dev, 1h prod

  /** Whether dev-mode is active. */
  isDevMode: DEV_MODE,

  /** Get mutation duration in ms. */
  getMutationDurationMs(): number {
    return this.MUTATION_DURATION_MS;
  },
};
