# 🚀 Step 3 Quick Reference Guide

## Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        App Launch                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                ┌────────────────┐
                │  Check Session │
                └────────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    No Session    Has Session     Has Session
                   (Unlocked)      (Locked)
          │              │              │
          ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │  Login   │   │  Floor   │   │   PIN    │
   │  Screen  │   │  View    │   │  Screen  │
   └──────────┘   └──────────┘   └──────────┘
          │              │              │
          │              │              │
    Email/Password       │         6-Digit PIN
    Rate Limited         │       Rate Limited
    (5 attempts)         │      (3 attempts)
          │              │              │
          ▼              │              ▼
    ┌──────────┐         │        ┌──────────┐
    │ Validate │         │        │ Validate │
    │  & Hash  │         │        │   PIN    │
    └──────────┘         │        └──────────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
                         ▼
                ┌────────────────┐
                │  Main POS App  │
                │                │
                │  - Floor View  │
                │  - Orders      │
                │  - Kitchen     │
                │  - etc.        │
                └────────────────┘
                         │
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    Background      Idle 5 min      Max 12 hrs
          │              │              │
          ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │   Lock   │   │   Lock   │   │  Logout  │
   │ → PIN    │   │ → PIN    │   │ → Login  │
   └──────────┘   └──────────┘   └──────────┘
```

## Key Files & Responsibilities

```
src/lib/security.ts          → Security utilities (PIN hash, rate limit, etc.)
hooks/use-auth.tsx           → Auth state & session management
app/(auth)/login.tsx         → Email/password login UI
app/(auth)/pin.tsx           → PIN unlock UI
app/(auth)/_layout.tsx       → Auth routing & guards
app/(app)/_layout.tsx        → Protected app routing & guards
src/lib/migrate-pins.ts      → PIN migration script
```

## Security Features at a Glance

### Login Security
| Feature | Implementation | Configuration |
|---------|---------------|---------------|
| Rate Limiting | ✅ 5 attempts / 15 min | `loginRateLimiter` in security.ts |
| Lockout | ✅ 30 min after max | Configurable in RateLimiter |
| Input Validation | ✅ Email format, length | validateEmail() |
| Error Messages | ✅ Safe, no leakage | getSafeErrorMessage() |
| Attempt Counter | ✅ Visual feedback | UI in login.tsx |

### PIN Security
| Feature | Implementation | Configuration |
|---------|---------------|---------------|
| Rate Limiting | ✅ 3 attempts / 5 min | `pinRateLimiter` in security.ts |
| Lockout | ✅ 15 min after max | Configurable in RateLimiter |
| Hashing | ✅ SHA-256 | hashPin() in security.ts |
| Comparison | ✅ Constant-time | verifyPin() in security.ts |
| Offline | ✅ Works offline | PowerSync local query |

### Session Security
| Feature | Implementation | Configuration |
|---------|---------------|---------------|
| Auto-Lock (Background) | ✅ Immediate | AppState listener in use-auth |
| Auto-Lock (Idle) | ✅ 5 min default | DEFAULT_IDLE_TIMEOUT_MS |
| Max Duration | ✅ 12 hours | MAX_SESSION_DURATION_HOURS |
| Validation | ✅ Every minute | validateSession() check |
| Activity Tracking | ✅ All touches | markActivity() calls |

## Common Tasks

### 1. Test Authentication
```typescript
// Test login
Email: test@example.com
Password: password123

// Test PIN
PIN: 123456

// Test rate limiting
- Try wrong password 5 times
- Observe 30-minute lockout
- Try wrong PIN 3 times
- Observe 15-minute lockout
```

### 2. Migrate Existing PINs
```typescript
import { runPinMigration } from '@/src/lib/migrate-pins';

// Run once when deploying
await runPinMigration();

// Output shows:
// - Number of PINs migrated
// - Number of failures
// - Verification results
```

### 3. Adjust Timeouts
```typescript
// In hooks/use-auth.tsx
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // Change this
const MAX_SESSION_DURATION_HOURS = 12; // Change this

// In src/lib/security.ts
export const loginRateLimiter = new RateLimiter(
  5,              // maxAttempts - Change this
  15 * 60 * 1000, // windowMs - Change this
  30 * 60 * 1000  // lockDurationMs - Change this
);
```

### 4. Access Auth State in Components
```typescript
import { useAuth } from '@/hooks/use-auth';

function MyComponent() {
  const {
    user,              // Current user profile with role
    isAuthenticated,   // Boolean
    isLocked,          // Boolean
    loginAttempts,     // Remaining login attempts
    pinAttempts,       // Remaining PIN attempts
    isLoginLocked,     // Boolean
    isPinLocked,       // Boolean
    signIn,            // Function
    signOut,           // Function
    unlockWithPin,     // Function
  } = useAuth();
  
  // Use as needed
}
```

### 5. Check Security Status
```typescript
// Check if PINs are hashed
import { verifyPinMigration } from '@/src/lib/migrate-pins';

const status = await verifyPinMigration();
console.log(status);
// Output: { total, hashed, plaintext, invalid }
```

### 6. Implement Audit Log Persistence
```typescript
// In src/lib/security.ts, update logAuditEvent():
export function logAuditEvent(event: AuditEvent): void {
  // Current (console only)
  if (__DEV__) {
    console.log('[AUDIT]', event);
  }
  
  // Add database persistence:
  powersync.execute(
    `INSERT INTO audit_logs (event_type, user_id, metadata, timestamp)
     VALUES (?, ?, ?, ?)`,
    [event.type, event.userId, JSON.stringify(event.metadata), event.timestamp]
  );
}
```

## Security Metrics to Monitor

### Real-Time Monitoring
```typescript
// Track these in your monitoring dashboard:

1. Failed login attempts per hour
   → Alert if > 50 per hour
   
2. Account lockouts per day
   → Alert if > 10 per day
   
3. Failed PIN attempts per hour
   → Alert if > 30 per hour
   
4. Average session duration
   → Monitor for anomalies
   
5. PIN unlock success rate
   → Should be > 95%
```

### Health Checks
```typescript
// Implement these health checks:

✓ All PINs are hashed (64 chars)
✓ No inactive users logged in
✓ Session expiry working
✓ Rate limiters functioning
✓ Audit logs being written
```

## Troubleshooting

### Issue: "Account temporarily locked"
**Solution**: Wait for lockout timer to expire, or reset rate limiter in code.

### Issue: "PIN not working"
**Solution**: Check if PIN is hashed. Run `verifyPinMigration()`. If plain-text, run migration.

### Issue: "Session expires too quickly"
**Solution**: Increase `DEFAULT_IDLE_TIMEOUT_MS` in use-auth.tsx.

### Issue: "User can't login after 12 hours"
**Solution**: This is expected. Max session duration forces re-login. Adjust `MAX_SESSION_DURATION_HOURS` if needed.

### Issue: Rate limiter not resetting
**Solution**: Check cleanup interval in security.ts. It runs every 5 minutes.

## Production Deployment Checklist

```
□ Run npm audit → Fix vulnerabilities
□ Run PIN migration → Hash all PINs
□ Configure Supabase RLS → Enable policies
□ Set up audit log table → Create in Supabase
□ Test on physical devices → Android tablets
□ Configure environment variables → Production URLs
□ Enable ProGuard/R8 → Code obfuscation
□ Test rate limiting → Multiple attempts
□ Test session expiry → Leave app idle
□ Monitor logs → Check for errors
```

## Quick Commands

```bash
# Start development
npm start

# Run linting
npm run lint

# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Build for production
npm run build:android
# or
npm run build:ios
```

## Important Constants

```typescript
// Timeouts
DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000      // 5 minutes
MAX_SESSION_DURATION_HOURS = 12               // 12 hours

// Rate Limits
LOGIN_MAX_ATTEMPTS = 5                        // 5 attempts
LOGIN_WINDOW_MS = 15 * 60 * 1000             // 15 minutes
LOGIN_LOCKOUT_MS = 30 * 60 * 1000            // 30 minutes

PIN_MAX_ATTEMPTS = 3                          // 3 attempts
PIN_WINDOW_MS = 5 * 60 * 1000                // 5 minutes
PIN_LOCKOUT_MS = 15 * 60 * 1000              // 15 minutes

// Security
PIN_LENGTH = 6                                // 6 digits
HASH_ALGORITHM = 'SHA-256'                    // Can upgrade to bcrypt
```

## API Reference

### Security Functions
```typescript
// PIN hashing
hashPin(pin: string): Promise<string>
verifyPin(pin: string, hashedPin: string): Promise<boolean>

// Validation
validateEmail(email: string): boolean
validatePinFormat(pin: string): boolean
sanitizeInput(input: string): string

// Rate limiting
loginRateLimiter.check(key: string)
loginRateLimiter.recordAttempt(key: string)
loginRateLimiter.reset(key: string)

// Error handling
getSafeErrorMessage(error: unknown): string

// Audit logging
logAuditEvent(event: AuditEvent): void
```

### Auth Hook
```typescript
const {
  // State
  loading: boolean
  session: Session | null
  user: UserRow | null
  isAuthenticated: boolean
  isLocked: boolean
  loginAttempts: number
  pinAttempts: number
  isLoginLocked: boolean
  isPinLocked: boolean
  
  // Actions
  signIn: (email, password) => Promise<void>
  signOut: () => Promise<void>
  unlockWithPin: (pin) => Promise<boolean>
  lock: () => void
  markActivity: () => void
  refreshProfile: () => Promise<void>
} = useAuth()
```

---

**Quick Reference Version**: 1.0
**Last Updated**: February 18, 2026
**For**: POS Tempest Step 3 Implementation
