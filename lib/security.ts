/**
 * Security utilities for POS Tempest
 * Handles PIN hashing, rate limiting, session validation, and security policies
 */

import * as Crypto from 'expo-crypto';

// ============================================================================
// PIN SECURITY
// ============================================================================

/**
 * Hash a PIN using SHA256 for secure storage
 * Note: For production, consider using bcrypt or Argon2 via Supabase Edge Functions
 * This provides basic protection against plain-text storage
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    throw new Error('Invalid PIN format. Must be 6 digits.');
  }

  // Use SHA256 as it's available in Expo Crypto
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin,
  );

  return hash;
}

/**
 * Verify a PIN against a hashed value with constant-time comparison
 */
export async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
  try {
    const inputHash = await hashPin(pin);
    
    // Constant-time comparison to prevent timing attacks
    if (inputHash.length !== hashedPin.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < inputHash.length; i++) {
      result |= inputHash.charCodeAt(i) ^ hashedPin.charCodeAt(i);
    }

    return result === 0;
  } catch {
    return false;
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  attempts: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  isLocked: boolean;
  lockUntil?: number;
}

class RateLimiter {
  private attempts = new Map<string, RateLimitEntry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockDurationMs: number;

  constructor(
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000, // 15 minutes
    lockDurationMs = 30 * 60 * 1000, // 30 minutes
  ) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockDurationMs = lockDurationMs;
  }

  /**
   * Check if an action is allowed for the given key
   * Returns { allowed: boolean, remainingAttempts: number, resetInMs: number }
   */
  check(key: string): {
    allowed: boolean;
    remainingAttempts: number;
    resetInMs: number;
    isLocked: boolean;
  } {
    const now = Date.now();
    const entry = this.attempts.get(key);

    // No previous attempts
    if (!entry) {
      return {
        allowed: true,
        remainingAttempts: this.maxAttempts,
        resetInMs: 0,
        isLocked: false,
      };
    }

    // Check if locked
    if (entry.isLocked && entry.lockUntil) {
      if (now < entry.lockUntil) {
        return {
          allowed: false,
          remainingAttempts: 0,
          resetInMs: entry.lockUntil - now,
          isLocked: true,
        };
      } else {
        // Lock expired, reset
        this.reset(key);
        return {
          allowed: true,
          remainingAttempts: this.maxAttempts,
          resetInMs: 0,
          isLocked: false,
        };
      }
    }

    // Check if window expired
    if (now - entry.firstAttemptTime > this.windowMs) {
      this.reset(key);
      return {
        allowed: true,
        remainingAttempts: this.maxAttempts,
        resetInMs: 0,
        isLocked: false,
      };
    }

    // Check if max attempts exceeded
    if (entry.attempts >= this.maxAttempts) {
      // Lock the account
      entry.isLocked = true;
      entry.lockUntil = now + this.lockDurationMs;
      return {
        allowed: false,
        remainingAttempts: 0,
        resetInMs: this.lockDurationMs,
        isLocked: true,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - entry.attempts,
      resetInMs: this.windowMs - (now - entry.firstAttemptTime),
      isLocked: false,
    };
  }

  /**
   * Record a failed attempt
   */
  recordAttempt(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.firstAttemptTime > this.windowMs) {
      // Start new window
      this.attempts.set(key, {
        attempts: 1,
        firstAttemptTime: now,
        lastAttemptTime: now,
        isLocked: false,
      });
    } else {
      // Increment attempts
      entry.attempts += 1;
      entry.lastAttemptTime = now;
    }
  }

  /**
   * Reset attempts for a key (e.g., after successful authentication)
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (
        now - entry.firstAttemptTime > this.windowMs &&
        (!entry.lockUntil || now > entry.lockUntil)
      ) {
        this.attempts.delete(key);
      }
    }
  }
}

// Global rate limiters for different operations
export const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000, 30 * 60 * 1000);
export const pinRateLimiter = new RateLimiter(3, 5 * 60 * 1000, 15 * 60 * 1000);

// ============================================================================
// SESSION VALIDATION
// ============================================================================

export interface SessionMetadata {
  deviceId?: string;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Validate session freshness and integrity
 */
export function validateSession(
  expiresAt: number | undefined,
  metadata?: SessionMetadata,
): {
  valid: boolean;
  reason?: string;
} {
  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (!expiresAt || expiresAt < now) {
    return { valid: false, reason: 'Session expired' };
  }

  // Check last activity (optional)
  if (metadata?.lastActivity) {
    const inactiveForMs = Date.now() - metadata.lastActivity;
    const maxInactiveMs = 24 * 60 * 60 * 1000; // 24 hours

    if (inactiveForMs > maxInactiveMs) {
      return { valid: false, reason: 'Session inactive too long' };
    }
  }

  return { valid: true };
}

// ============================================================================
// INPUT VALIDATION & SANITIZATION
// ============================================================================

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate PIN format (6 digits)
 */
export function validatePinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 255); // Limit length
}

// ============================================================================
// SECURE ERROR MESSAGES
// ============================================================================

/**
 * Return user-safe error messages that don't leak security information
 */
export function getSafeErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Map technical errors to user-friendly messages
    if (message.includes('invalid login') || message.includes('invalid credentials')) {
      return 'Invalid email or password';
    }

    if (message.includes('email not confirmed')) {
      return 'Please verify your email address';
    }

    if (message.includes('too many requests')) {
      return 'Too many attempts. Please try again later';
    }

    if (message.includes('network')) {
      return 'Network error. Please check your connection';
    }

    if (message.includes('timeout')) {
      return 'Request timed out. Please try again';
    }

    // Generic message for other errors
    return 'Authentication failed. Please try again';
  }

  return 'An unexpected error occurred';
}

// ============================================================================
// PASSWORD STRENGTH VALIDATION (for future use)
// ============================================================================

export interface PasswordStrength {
  valid: boolean;
  score: number; // 0-4
  feedback: string[];
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return { valid: false, score: 0, feedback: ['Password is required'] };
  }

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Include at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Include at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    feedback.push('Include at least one number');
  } else {
    score += 1;
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Include at least one special character');
  } else {
    score += 1;
  }

  const valid = score >= 3 && password.length >= 8;

  return { valid, score, feedback };
}

// ============================================================================
// AUDIT LOGGING (for future implementation)
// ============================================================================

export enum AuditEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PIN_UNLOCK_SUCCESS = 'PIN_UNLOCK_SUCCESS',
  PIN_UNLOCK_FAILED = 'PIN_UNLOCK_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export interface AuditEvent {
  type: AuditEventType;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log security-related events for audit trail
 * In production, this should write to a secure audit log table
 */
export function logAuditEvent(event: AuditEvent): void {
  // TODO: Implement proper audit logging to database
  if (__DEV__) {
    console.log('[AUDIT]', event);
  }
}

// ============================================================================
// CLEANUP SCHEDULER
// ============================================================================

// Clean up rate limiter entries every 5 minutes
setInterval(() => {
  loginRateLimiter.cleanup();
  pinRateLimiter.cleanup();
}, 5 * 60 * 1000);
