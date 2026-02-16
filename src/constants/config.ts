/**
 * App-wide configuration constants.
 */

export const Config = {
  /** Auto-lock timeout in milliseconds */
  IDLE_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  
  /** Order number prefix */
  ORDER_PREFIX: 'ORD',
  
  /** Kitchen ticket prefix */
  TICKET_PREFIX: 'KOT',
  
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