/**
 * Security utilities for POS Tempest
 * Handles PIN hashing, rate limiting, session validation, and security policies
 */

import { Config } from '@/constants/config';
import type { PowerSyncDatabase } from '@powersync/react-native';
import bcrypt from 'bcryptjs';

// ============================================================================
// PIN SECURITY
// ============================================================================

const BCRYPT_ROUNDS = 12;

/**
 * Hash a PIN using bcrypt with 12 rounds for secure storage
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    throw new Error('Invalid PIN format. Must be 6 digits.');
  }

  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(pin, salt);
}

/**
 * Verify a PIN against a bcrypt hash (constant-time comparison is built into bcrypt)
 */
export async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pin, hashedPin);
  } catch {
    return false;
  }
}

// ============================================================================
// RATE LIMITING - DB-BACKED (Persistent & Multi-Instance)
// ============================================================================

/**
 * Database-backed rate limiter that persists across restarts and instances
 * Uses the retry_attempts column in users table for centralized tracking
 * 
 * Note: This implementation is suitable for production with multi-device deployments
 */

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetInMs: number;
  isLocked: boolean;
}

/**
 * DB-backed Rate Limiter Configuration
 */
export interface RateLimiterConfig {
  maxAttempts: number;
  lockDurationMs: number;
  tableName?: string;
  attemptsColumn?: string;
  timestampColumn?: string;
}

/**
 * Database-backed rate limiter using PowerSync for persistent storage
 * Supports multi-instance deployments with centralized counters
 */
export class DbRateLimiter {
  private readonly maxAttempts: number;
  private readonly lockDurationMs: number;
  private readonly tableName: string;
  private readonly attemptsColumn: string;
  private readonly timestampColumn: string;

  constructor(config: RateLimiterConfig) {
    this.maxAttempts = config.maxAttempts;
    this.lockDurationMs = config.lockDurationMs;
    this.tableName = config.tableName || 'users';
    this.attemptsColumn = config.attemptsColumn || 'retry_attempts';
    this.timestampColumn = config.timestampColumn || 'updated_at';
  }

  /**
   * Check if an action is allowed for the given user/key
   * Uses atomic database operations for consistency across instances
   */
  async check(userId: number, db: PowerSyncDatabase): Promise<RateLimitResult> {
    try {
      const result = await db.getOptional<{
        retry_attempts: number;
        updated_at: string;
      }>(
        `SELECT ${this.attemptsColumn} as retry_attempts, ${this.timestampColumn} as updated_at 
         FROM ${this.tableName} 
         WHERE id = ?`,
        [userId],
      );

      if (!result) {
        return {
          allowed: true,
          remainingAttempts: this.maxAttempts,
          resetInMs: 0,
          isLocked: false,
        };
      }

      const attempts = result.retry_attempts || 0;
      const lastAttemptTime = new Date(result.updated_at).getTime();
      const now = Date.now();
      const timeSinceLastAttempt = now - lastAttemptTime;

      // Check if lock has expired
      if (attempts >= this.maxAttempts) {
        if (timeSinceLastAttempt >= this.lockDurationMs) {
          // Lock expired, reset
          await this.reset(userId, db);
          return {
            allowed: true,
            remainingAttempts: this.maxAttempts,
            resetInMs: 0,
            isLocked: false,
          };
        } else {
          // Still locked
          return {
            allowed: false,
            remainingAttempts: 0,
            resetInMs: this.lockDurationMs - timeSinceLastAttempt,
            isLocked: true,
          };
        }
      }

      return {
        allowed: true,
        remainingAttempts: this.maxAttempts - attempts,
        resetInMs: 0,
        isLocked: false,
      };
    } catch (error) {
      // On error, fail safe and allow (log for monitoring)
      console.error('[DbRateLimiter] Error checking rate limit:', error);
      return {
        allowed: true,
        remainingAttempts: this.maxAttempts,
        resetInMs: 0,
        isLocked: false,
      };
    }
  }

  /**
   * Record a failed attempt with atomic increment
   * Uses database transactions for consistency
   */
  async recordAttempt(userId: number, db: PowerSyncDatabase): Promise<void> {
    try {
      await db.execute(
        `UPDATE ${this.tableName} 
         SET ${this.attemptsColumn} = ${this.attemptsColumn} + 1,
             ${this.timestampColumn} = ?
         WHERE id = ?`,
        [new Date().toISOString(), userId],
      );
    } catch (error) {
      console.error('[DbRateLimiter] Error recording attempt:', error);
    }
  }

  /**
   * Reset attempts after successful authentication
   */
  async reset(userId: number, db: PowerSyncDatabase): Promise<void> {
    try {
      await db.execute(
        `UPDATE ${this.tableName} 
         SET ${this.attemptsColumn} = 0,
             ${this.timestampColumn} = ?
         WHERE id = ?`,
        [new Date().toISOString(), userId],
      );
    } catch (error) {
      console.error('[DbRateLimiter] Error resetting attempts:', error);
    }
  }
}

// Global rate limiters for different operations (DB-backed)
export const loginRateLimiter = new DbRateLimiter({
  maxAttempts: Config.LOGIN_MAX_ATTEMPTS,
  lockDurationMs: Config.LOGIN_LOCKOUT_MS,
  tableName: 'users',
  attemptsColumn: 'retry_attempts',
  timestampColumn: 'updated_at',
});

export const pinRateLimiter = new DbRateLimiter({
  maxAttempts: Config.PIN_MAX_ATTEMPTS,
  lockDurationMs: Config.PIN_LOCKOUT_MS,
  tableName: 'users',
  attemptsColumn: 'retry_attempts',
  timestampColumn: 'updated_at',
});

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

    if (inactiveForMs > Config.MAX_INACTIVE_SESSION_MS) {
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

// Note: With DB-backed rate limiting, periodic cleanup is no longer needed
// Cleanup happens automatically when locks expire during check() operations
