/**
 * Device Registration Service for POS Tempest
 * Handles device registration, status management, and branch association.
 * 
 * Devices are physical POS terminals (tablets) that are registered to a branch.
 * Shifts and cash drawers are scoped to devices, not users.
 */

import { DEVICE_STATUS } from '@/constants/enums';
import type { Branch, Device } from '@/db/models';
import { powersync } from '@/db/provider';

/**
 * Result of device registration check
 */
export interface DeviceRegistrationResult {
  registered: boolean;
  device: Device | null;
  branch: Branch | null;
}

/**
 * Registers a new device in the database.
 * Creates a device record with the given branch association.
 * 
 * @param deviceUid - Unique device identifier (UUID from AsyncStorage)
 * @param branchId - Branch ID to associate the device with
 * @param deviceName - Human-readable name (e.g., "Kasir 1", "Bar")
 * @returns The created device record
 */
export async function registerDevice(
  deviceUid: string,
  branchId: number,
  deviceName: string
): Promise<Device> {
  const now = new Date().toISOString();
  
  // Check if device is already registered
  const existing = await getDeviceRegistration(deviceUid);
  
  if (existing.registered && existing.device) {
    // Update existing device instead of creating new
    await powersync.execute(
      `UPDATE devices 
       SET branch_id = ?, device_name = ?, status = ?, last_seen_at = ?
       WHERE device_uid = ?`,
      [branchId, deviceName, DEVICE_STATUS.ACTIVE, now, deviceUid]
    );
    
    return {
      ...existing.device,
      branch_id: branchId,
      device_name: deviceName,
      status: DEVICE_STATUS.ACTIVE,
      last_seen_at: now,
    };
  }
  
  // Insert new device record
  await powersync.execute(
    `INSERT INTO devices (branch_id, device_uid, device_name, status, registered_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [branchId, deviceUid, deviceName, DEVICE_STATUS.ACTIVE, now, now]
  );
  
  // Fetch the created device
  const device = await powersync.getOptional<Device>(
    `SELECT * FROM devices WHERE device_uid = ?`,
    [deviceUid]
  );
  
  if (!device) {
    throw new Error('Failed to create device record');
  }
  
  console.log('[DeviceService] Registered device:', deviceUid, 'as', deviceName, 'for branch', branchId);
  return device;
}

/**
 * Gets the registration status and details for a device.
 * 
 * @param deviceUid - Unique device identifier
 * @returns Registration result with device and branch info
 */
export async function getDeviceRegistration(
  deviceUid: string
): Promise<DeviceRegistrationResult> {
  try {
    const device = await powersync.getOptional<Device>(
      `SELECT * FROM devices WHERE device_uid = ?`,
      [deviceUid]
    );
    
    if (!device) {
      return { registered: false, device: null, branch: null };
    }
    
    // Get associated branch
    const branch = await powersync.getOptional<Branch>(
      `SELECT * FROM branches WHERE id = ?`,
      [device.branch_id]
    );
    
    return {
      registered: device.status === DEVICE_STATUS.ACTIVE,
      device,
      branch: branch || null,
    };
  } catch (error) {
    console.error('[DeviceService] Error getting device registration:', error);
    return { registered: false, device: null, branch: null };
  }
}

/**
 * Checks if a device is registered and active.
 * 
 * @param deviceUid - Unique device identifier
 * @returns true if device is registered and active
 */
export async function isDeviceRegistered(
  deviceUid: string
): Promise<boolean> {
  const result = await getDeviceRegistration(deviceUid);
  return result.registered;
}

/**
 * Updates the last seen timestamp for a device.
 * Should be called periodically to track device activity.
 * 
 * @param deviceUid - Unique device identifier
 */
export async function updateDeviceLastSeen(
  deviceUid: string
): Promise<void> {
  const now = new Date().toISOString();
  
  await powersync.execute(
    `UPDATE devices SET last_seen_at = ? WHERE device_uid = ?`,
    [now, deviceUid]
  );
}

/**
 * Deactivates a device (admin only).
 * The device will need to re-register to use the POS.
 * 
 * @param deviceUid - Unique device identifier
 */
export async function deactivateDevice(
  deviceUid: string
): Promise<void> {
  await powersync.execute(
    `UPDATE devices SET status = ? WHERE device_uid = ?`,
    [DEVICE_STATUS.INACTIVE, deviceUid]
  );
  
  console.log('[DeviceService] Deactivated device:', deviceUid);
}

/**
 * Reactivates a deactivated device.
 * 
 * @param deviceUid - Unique device identifier
 */
export async function reactivateDevice(
  deviceUid: string
): Promise<void> {
  await powersync.execute(
    `UPDATE devices SET status = ?, last_seen_at = ? WHERE device_uid = ?`,
    [DEVICE_STATUS.ACTIVE, new Date().toISOString(), deviceUid]
  );
  
  console.log('[DeviceService] Reactivated device:', deviceUid);
}

/**
 * Updates the friendly name of a device.
 * 
 * @param deviceUid - Unique device identifier
 * @param newName - New device name
 */
export async function updateDeviceName(
  deviceUid: string,
  newName: string
): Promise<void> {
  await powersync.execute(
    `UPDATE devices SET device_name = ? WHERE device_uid = ?`,
    [newName, deviceUid]
  );
  
  console.log('[DeviceService] Updated device name:', deviceUid, '->', newName);
}

/**
 * Gets all devices for a specific branch.
 * Used in admin device management.
 * 
 * @param branchId - Branch ID
 * @returns List of devices for the branch
 */
export async function getDevicesByBranch(
  branchId: number
): Promise<Device[]> {
  const devices = await powersync.getAll<Device>(
    `SELECT * FROM devices WHERE branch_id = ? ORDER BY registered_at DESC`,
    [branchId]
  );
  
  return devices;
}

/**
 * Gets all active devices for a specific branch.
 * 
 * @param branchId - Branch ID
 * @returns List of active devices for the branch
 */
export async function getActiveDevicesByBranch(
  branchId: number
): Promise<Device[]> {
  const devices = await powersync.getAll<Device>(
    `SELECT * FROM devices WHERE branch_id = ? AND status = ? ORDER BY device_name`,
    [branchId, DEVICE_STATUS.ACTIVE]
  );
  
  return devices;
}

/**
 * Gets a device by its database ID.
 * 
 * @param deviceId - Device database ID
 * @returns Device or null
 */
export async function getDeviceById(
  deviceId: number
): Promise<Device | null> {
  return await powersync.getOptional<Device>(
    `SELECT * FROM devices WHERE id = ?`,
    [deviceId]
  );
}

/**
 * Gets all branches for device registration selection.
 * 
 * @returns List of active branches
 */
export async function getActiveBranches(): Promise<Branch[]> {
  const branches = await powersync.getAll<Branch>(
    `SELECT * FROM branches WHERE is_active = 1 ORDER BY name`
  );
  
  return branches;
}

/**
 * Deletes a device record completely.
 * Use with caution - this removes all device history.
 * 
 * @param deviceUid - Unique device identifier
 */
export async function deleteDevice(
  deviceUid: string
): Promise<void> {
  await powersync.execute(
    `DELETE FROM devices WHERE device_uid = ?`,
    [deviceUid]
  );
  
  console.log('[DeviceService] Deleted device:', deviceUid);
}
