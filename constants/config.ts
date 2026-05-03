/**
 * App-wide configuration constants.
 */

export const Config = {
  // ============================================================================
  // SESSION & AUTH
  // ============================================================================
  
  /** Auto-lock timeout in milliseconds */
  IDLE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  
  /** Whether the PIN lock screen is enabled (1 = enabled, 0 = disabled) */
  PIN_LOCK_ENABLED: 1 as 0 | 1,
  
  /** Maximum session duration in hours */
  MAX_SESSION_DURATION_HOURS: 12,
  
  /** Maximum inactive session duration in milliseconds */
  MAX_INACTIVE_SESSION_MS: 24 * 60 * 60 * 1000, // 24 hours
  
  /** Session validity check interval in milliseconds */
  SESSION_CHECK_INTERVAL_MS: 60 * 1000, // 1 minute
  
  // ============================================================================
  // RATE LIMITING - LOGIN
  // ============================================================================
  
  /** Maximum login attempts before lockout */
  LOGIN_MAX_ATTEMPTS: 5,
  
  /** Login rate limit window in milliseconds */
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  
  /** Login lockout duration in milliseconds */
  LOGIN_LOCKOUT_MS: 10 * 60 * 1000, // 10 minutes
  
  // ============================================================================
  // RATE LIMITING - PIN
  // ============================================================================
  
  /** Maximum PIN unlock attempts before lockout */
  PIN_MAX_ATTEMPTS: 3,
  
  /** PIN rate limit window in milliseconds */
  PIN_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  
  /** PIN lockout duration in milliseconds */
  PIN_LOCKOUT_MS: 15 * 60 * 1000, // 15 minutes
  
  /** PIN length requirement */
  PIN_LENGTH: 6,
  
  // ============================================================================
  // RATE LIMITER CLEANUP
  // ============================================================================
  
  /** Rate limiter cleanup interval in milliseconds */
  RATE_LIMITER_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  
  // ============================================================================
  // BUSINESS LOGIC
  // ============================================================================
  
  /** Order number prefix */
  ORDER_PREFIX: 'ORD',
  
  /** Kitchen ticket prefix */
  TICKET_PREFIX: 'TIKET',
  
  /** Max items per order */
  MAX_ORDER_ITEMS: 100,
  
  /** Currency code */
  CURRENCY: 'IDR',
  
  /** Timezone */
  TIMEZONE: 'Asia/Jakarta',

  /** Default rounding precision for order totals (1=exact, 10=tens, 100=hundreds, 1000=thousands) */
  DEFAULT_ROUNDING_PRECISION: 1000,

  /** Available rounding precision options for the settings UI */
  ROUNDING_PRECISION_OPTIONS: [
    { value: 1, label: 'Exact' },
    { value: 10, label: '10' },
    { value: 100, label: '100' },
    { value: 1000, label: '1.000' },
  ] as readonly { value: number; label: string }[],

  // ============================================================================
  // NETWORK
  // ============================================================================

  /** API request timeout in milliseconds */
  API_TIMEOUT_MS: 10_000, // 10 seconds

  // ============================================================================
  // BLUETOOTH PRINTER
  // ============================================================================

  /** Bluetooth printer connect timeout in milliseconds */
  BT_CONNECT_TIMEOUT_MS: 15_000, // 15 seconds

  /** Bluetooth printer send data timeout in milliseconds */
  BT_SEND_TIMEOUT_MS: 10_000, // 10 seconds

  /** Bluetooth printer ping timeout in milliseconds */
  BT_PING_TIMEOUT_MS: 8_000, // 8 seconds

  /** Bluetooth printer scan timeout in milliseconds */
  BT_SCAN_TIMEOUT_MS: 10_000, // 10 seconds

  // ============================================================================
  // DATABASE
  // ============================================================================

  /** Minimum Supabase processLock acquire timeout to reduce contention warnings */
  SUPABASE_LOCK_MIN_TIMEOUT_MS: 15_000, // 15 seconds

  // ============================================================================
  // PROFILE SYNC
  // ============================================================================

  /** Maximum retries when waiting for PowerSync to sync user data on fresh install */
  PROFILE_FETCH_MAX_RETRIES: 12,

  /** Initial delay between profile fetch retries in milliseconds (doubles each attempt) */
  PROFILE_FETCH_INITIAL_DELAY_MS: 500,

  /** Maximum delay between profile fetch retries in milliseconds */
  PROFILE_FETCH_MAX_DELAY_MS: 4_000, // 4 seconds

  // ============================================================================
  // SECURITY
  // ============================================================================

  /** bcrypt cost factor — lowered for mobile JS performance */
  BCRYPT_ROUNDS: 6,

  /** Maximum length for sanitized user input */
  SANITIZE_MAX_LENGTH: 255,

  /** Minimum password length */
  PASSWORD_MIN_LENGTH: 8,

  /** Minimum password strength score (out of 5) */
  PASSWORD_MIN_SCORE: 3,

  // ============================================================================
  // STORAGE KEYS
  // ============================================================================

  /** AsyncStorage key for printer settings */
  STORAGE_KEY_PRINTER_SETTINGS: '@pos_tempest/printer_settings',

  // ============================================================================
  // UI
  // ============================================================================

  /** Maximum number of digits allowed in cash amount input */
  CASH_AMOUNT_MAX_INPUT_LENGTH: 9,
} as const;