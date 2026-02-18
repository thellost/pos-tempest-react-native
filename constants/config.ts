/**
 * App-wide configuration constants.
 */

export const Config = {
  // ============================================================================
  // SESSION & AUTH
  // ============================================================================
  
  /** Auto-lock timeout in milliseconds */
  IDLE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  
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
  LOGIN_LOCKOUT_MS: 30 * 60 * 1000, // 30 minutes
  
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
  
  /** Default tax rate (PPN 11%) */
  TAX_RATE: 0.11,
  
  /** Default service charge rate (5%) */
  SERVICE_CHARGE_RATE: 0.05,
  
  /** Currency code */
  CURRENCY: 'IDR',
  
  /** Timezone */
  TIMEZONE: 'Asia/Jakarta',
} as const;