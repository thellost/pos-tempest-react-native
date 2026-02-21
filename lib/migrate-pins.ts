/**
 * Migration Script: Hash Existing PINs
 * 
 * This script hashes all existing plain-text PINs in the users table.
 * Run this ONCE when deploying the new authentication system.
 * 
 * IMPORTANT: Back up your database before running this migration!
 */

import { powersync } from '@/db/provider';
import { hashPin } from '@/lib/security';

interface UserWithPin {
  id: number;
  pin_code: string;
  name: string;
}

interface UserPinSnapshot {
  id: number;
  name: string;
  pin_code: string | null;
}

/**
 * Log local DB PIN snapshot (safe preview) after migration.
 */
export async function logLocalDbAfterMigration(): Promise<void> {
  console.log('[PIN Migration] Reading local DB snapshot after migration...');

  const users = await powersync.getAll<UserPinSnapshot>(
    `
      SELECT id, name, pin_code
      FROM users
      ORDER BY id ASC
    `,
  );

  if (users.length === 0) {
    console.log('[PIN Migration] Local DB snapshot is empty (no users found).');
    return;
  }

  console.log('[PIN Migration] Local DB snapshot:');

  for (const user of users) {
    const pin = user.pin_code ?? '';
    const pinLength = pin.length;
    const pinState =
      pinLength === 0 ? 'empty' : pinLength === 64 ? 'hashed' : /^\d{6}$/.test(pin) ? 'plaintext' : 'invalid';
    const pinPreview = pinLength === 64 ? `${pin.slice(0, 8)}...${pin.slice(-6)}` : pinLength === 0 ? 'none' : '[hidden]';

    console.log(
      `[PIN Migration] user=${user.id} name="${user.name}" state=${pinState} length=${pinLength} preview=${pinPreview}`,
    );
  }
}

/**
 * Hash all plain-text PINs in the database
 */
export async function migrateExistingPins(): Promise<{
  success: number;
  failed: number;
  errors: Array<{ userId: number; error: string }>;
}> {
  console.log('[PIN Migration] Starting PIN migration...');
  
  let success = 0;
  let failed = 0;
  const errors: Array<{ userId: number; error: string }> = [];

  try {
    // Fetch all users with PINs
    const usersWithPins = await powersync.getAll<UserWithPin>(
      `
        SELECT id, pin_code, name
        FROM users
        WHERE pin_code IS NOT NULL
          AND pin_code != ''
          AND length(pin_code) = 6
      `,
    );

    console.log(`[PIN Migration] Found ${usersWithPins.length} users with PINs to migrate`);

    // Hash each PIN
    for (const user of usersWithPins) {
      try {
        // Check if PIN is already hashed (SHA-256 produces 64 character hex string)
        if (user.pin_code.length === 64) {
          console.log(`[PIN Migration] Skipping user ${user.id} (${user.name}) - PIN already hashed`);
          continue;
        }

        // Validate PIN format (6 digits)
        if (!/^\d{6}$/.test(user.pin_code)) {
          console.warn(`[PIN Migration] Invalid PIN format for user ${user.id} (${user.name})`);
          failed++;
          errors.push({
            userId: user.id,
            error: 'Invalid PIN format (must be 6 digits)',
          });
          continue;
        }

        // Hash the PIN
        const hashedPin = await hashPin(user.pin_code);

        // Update in database
        await powersync.execute(
          'UPDATE users SET pin_code = ? WHERE id = ?',
          [hashedPin, user.id],
        );

        console.log(`[PIN Migration] ✓ Hashed PIN for user ${user.id} (${user.name})`);
        success++;
      } catch (error) {
        console.error(`[PIN Migration] ✗ Failed to hash PIN for user ${user.id} (${user.name})`, error);
        failed++;
        errors.push({
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[PIN Migration] Migration complete');
    console.log(`[PIN Migration] Success: ${success}, Failed: ${failed}`);

    return { success, failed, errors };
  } catch (error) {
    console.error('[PIN Migration] Fatal error during migration:', error);
    throw error;
  }
}

/**
 * Verify PIN migration
 * Checks that all PINs are properly hashed
 */
export async function verifyPinMigration(): Promise<{
  total: number;
  hashed: number;
  plaintext: number;
  invalid: number;
}> {
  console.log('[PIN Migration] Verifying PIN migration...');

  const usersWithPins = await powersync.getAll<UserWithPin>(
    `
      SELECT id, pin_code, name
      FROM users
      WHERE pin_code IS NOT NULL AND pin_code != ''
    `,
  );

  let hashed = 0;
  let plaintext = 0;
  let invalid = 0;

  for (const user of usersWithPins) {
    if (user.pin_code.length === 64) {
      // SHA-256 hash
      hashed++;
    } else if (/^\d{6}$/.test(user.pin_code)) {
      // Plain-text 6-digit PIN
      console.warn(`[PIN Migration] User ${user.id} (${user.name}) still has plain-text PIN`);
      plaintext++;
    } else {
      // Invalid format
      console.error(`[PIN Migration] User ${user.id} (${user.name}) has invalid PIN format`);
      invalid++;
    }
  }

  console.log('[PIN Migration] Verification complete');
  console.log(`[PIN Migration] Total: ${usersWithPins.length}, Hashed: ${hashed}, Plain-text: ${plaintext}, Invalid: ${invalid}`);

  return {
    total: usersWithPins.length,
    hashed,
    plaintext,
    invalid,
  };
}

/**
 * CLI interface for running migration
 */
export async function runPinMigration() {
  try {
    console.log('========================================');
    console.log('  PIN Migration Script');
    console.log('========================================\n');

    // First, verify current state
    console.log('1. Checking current PIN state...\n');
    const preCheck = await verifyPinMigration();

    if (preCheck.plaintext === 0) {
      console.log('\n✓ All PINs are already hashed. No migration needed.');
      return;
    }

    console.log(`\n⚠️  Found ${preCheck.plaintext} plain-text PINs that need to be hashed.`);
    console.log('\n2. Starting migration...\n');

    // Run migration
    const result = await migrateExistingPins();

    // Verify migration
    console.log('\n3. Verifying migration...\n');
    const postCheck = await verifyPinMigration();

    // Summary
    console.log('\n========================================');
    console.log('  Migration Summary');
    console.log('========================================');
    console.log(`Successfully hashed: ${result.success} PINs`);
    console.log(`Failed: ${result.failed} PINs`);
    console.log(`Plain-text remaining: ${postCheck.plaintext}`);
    console.log(`Invalid PINs: ${postCheck.invalid}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((err) => {
        console.log(`  - User ${err.userId}: ${err.error}`);
      });
    }

    if (postCheck.plaintext === 0 && postCheck.invalid === 0) {
      console.log('\n✓ Migration successful! All PINs are now securely hashed.');
    } else {
      console.log('\n⚠️  Migration incomplete. Please review errors above.');
    }

    console.log('\n4. Logging local DB snapshot...\n');
    await logLocalDbAfterMigration();

    console.log('========================================\n');
  } catch (error) {
    console.error('\n✗ Migration failed with error:', error);
    throw error;
  }
}

// Export for use in scripts or admin panel
export default {
  migrateExistingPins,
  verifyPinMigration,
  logLocalDbAfterMigration,
  runPinMigration,
};
