import * as Updates from 'expo-updates';

/**
 * Resolves the Supabase / Postgres schema this app should read & write to.
 *
 * Priority (highest first):
 *   1. EXPO_PUBLIC_SUPABASE_DB_SCHEMA env var
 *      Bundled into the JS at OTA-publish time. EAS reads its
 *      `--environment` value (auto-mapped from `--channel`) and inlines
 *      the matching dashboard env var. This is the preferred mechanism.
 *   2. Updates.channel (runtime EAS channel)
 *        - 'production' -> 'pos_tempest_prod'
 *        - 'preview'    -> 'pos_tempest'
 *        - other        -> below
 *   3. Safety net: in any non-dev (release) build with no channel info,
 *      default to 'pos_tempest_prod'. A signed/release binary must NEVER
 *      silently write to the dev schema.
 *   4. Otherwise (Metro / dev client) -> 'pos_tempest'.
 *
 * NOTE: do NOT use `Constants.expoConfig?.updates?.channel` here — that
 * reads from the static app.json manifest, not the runtime EAS channel.
 * `Updates.channel` (from expo-updates) is the value injected at update
 * time and the only reliable runtime source.
 */
export function resolvePosSchema(): string {
  const override = process.env.EXPO_PUBLIC_SUPABASE_DB_SCHEMA;
  if (override && override.trim().length > 0) {
    return override.trim();
  }

  const channel = (Updates.channel ?? '').toLowerCase();

  if (channel === 'production') return 'pos_tempest_prod';
  if (channel === 'preview') return 'pos_tempest';
  if (channel === 'development') return 'pos_tempest';

  if (!__DEV__) return 'pos_tempest_prod';

  return 'pos_tempest';
}

export const POS_SCHEMA = resolvePosSchema();
