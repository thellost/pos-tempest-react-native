/**
 * Device Registration Service for POS Tempest
 * Handles device registration, status management, and branch association.
 * 
 * Devices are physical POS terminals (tablets) that are registered to a branch.
 * Shifts and cash drawers are scoped to devices, not users.
 */

import { AUDIT_ACTION, DEVICE_STATUS } from '@/constants/enums';
import type { Branch, Device } from '@/db/models';
import { powersync } from '@/db/provider';
import { captureError } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { insertAuditLog } from '@/services/audit.service';

interface RemoteDeviceRecord {
  device_uid: string;
  branch_id: number;
  device_name: string;
  status: Device['status'];
  registered_at: Device['registered_at'];
  last_seen_at: Device['last_seen_at'];
}

function mapRemoteDeviceRecord(record: RemoteDeviceRecord): Device {
  return {
    id: record.device_uid,
    branch_id: record.branch_id,
    device_name: record.device_name,
    status: record.status,
    registered_at: record.registered_at,
    last_seen_at: record.last_seen_at,
  };
}

async function syncRecoveredDeviceLocally(
  deviceUid: string,
  branchId: number,
  deviceName: string,
  registeredAt: string,
  lastSeenAt: string
): Promise<Device> {
  const localDevice = await powersync.getOptional<Device>(
    `SELECT * FROM devices WHERE id = ?`,
    [deviceUid]
  );

  if (localDevice) {
    await powersync.execute(
      `UPDATE devices SET branch_id = ?, device_name = ?, status = ?, registered_at = ?, last_seen_at = ? WHERE id = ?`,
      [branchId, deviceName, DEVICE_STATUS.ACTIVE, registeredAt, lastSeenAt, deviceUid]
    );
  } else {
    await powersync.execute(
      `INSERT INTO devices (id, branch_id, device_name, status, registered_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [deviceUid, branchId, deviceName, DEVICE_STATUS.ACTIVE, registeredAt, lastSeenAt]
    );
  }

  const device = await powersync.getOptional<Device>(`SELECT * FROM devices WHERE id = ?`, [deviceUid]);
  if (!device) {
    throw new Error('Failed to persist recovered device record locally');
  }

  return device;
}

/**
 * Result of device registration check
 */
export interface DeviceRegistrationResult {
  registered: boolean;
  device: Device | null;
  branch: Branch | null;
}

/**
 * Thrown when attempting to register a device with a name already in use on the same branch.
 */
export class DeviceNameTakenError extends Error {
  constructor(public readonly deviceName: string) {
    super('DEVICE_NAME_TAKEN');
    this.name = 'DeviceNameTakenError';
  }
}

/**
 * Thrown when attempting to register a device that exists but is inactive.
 * The admin must reactivate it instead.
 */
export class DeviceInactiveError extends Error {
  constructor(public readonly device: Device) {
    super('DEVICE_INACTIVE');
    this.name = 'DeviceInactiveError';
  }
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
  if (!deviceUid) {
    throw new Error('Device UID is required for registration');
  }

  const now = new Date().toISOString();
  
  // Check if device already exists (active OR inactive)
  const existing = await getDeviceRegistration(deviceUid);

  if (!existing.device) {
    // Guard: check if the device name is already taken on this branch
    const nameTaken = await powersync.getOptional<Device>(
      `SELECT id FROM devices WHERE device_name = ? AND branch_id = ? AND status = ?`,
      [deviceName, branchId, DEVICE_STATUS.ACTIVE]
    );
    if (nameTaken) {
      throw new DeviceNameTakenError(deviceName);
    }
  }

  if (existing.device) {
    if (existing.device.status === DEVICE_STATUS.INACTIVE) {
      throw new DeviceInactiveError(existing.device);
    }

    const device = await syncRecoveredDeviceLocally(
      deviceUid,
      branchId,
      deviceName,
      existing.device.registered_at,
      now
    );

    void insertAuditLog({
      action: AUDIT_ACTION.UPDATE,
      tableName: 'devices',
      recordId: device.id,
      newValues: { branch_id: branchId, device_name: deviceName, status: DEVICE_STATUS.ACTIVE },
      description: `Device re-registered: ${deviceName} (${deviceUid})`,
    });

    return device;
  }

  // Local DB has no record — check Supabase directly in case the device was
  // previously registered but the local DB hasn't synced yet (e.g. fresh install).
  const { data: serverDevice, error: serverDeviceError } = await supabase
    .from('devices')
    .select('device_uid, branch_id, device_name, status, registered_at, last_seen_at')
    .eq('device_uid', deviceUid)
    .maybeSingle<RemoteDeviceRecord>();

  if (serverDeviceError) {
    throw serverDeviceError;
  }

  if (serverDevice) {
    if (serverDevice.status === DEVICE_STATUS.INACTIVE) {
      throw new DeviceInactiveError(mapRemoteDeviceRecord(serverDevice));
    }

    const device = await syncRecoveredDeviceLocally(
      deviceUid,
      branchId,
      deviceName,
      serverDevice.registered_at,
      now
    );

    void insertAuditLog({
      action: AUDIT_ACTION.UPDATE,
      tableName: 'devices',
      recordId: device.id,
      newValues: { branch_id: branchId, device_name: deviceName, status: DEVICE_STATUS.ACTIVE },
      description: `Device re-registered (recovered from server): ${deviceName} (${deviceUid})`,
    });

    return device;
  }

  // Truly new device — device_uid is the primary key, use it directly as id
  await powersync.execute(
    `INSERT INTO devices (id, branch_id, device_name, status, registered_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [deviceUid, branchId, deviceName, DEVICE_STATUS.ACTIVE, now, now]
  );

  const device = await powersync.getOptional<Device>(`SELECT * FROM devices WHERE id = ?`, [deviceUid]);
  if (!device) throw new Error('Failed to create device record');

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'devices',
    recordId: deviceUid,
    newValues: { branch_id: branchId, device_name: deviceName },
    description: `Device registered: ${deviceName} (${deviceUid})`,
  });

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
    const localDevice = await powersync.getOptional<Device>(
      `SELECT * FROM devices WHERE id = ?`,
      [deviceUid]
    );
    let device = localDevice;

    // Local DB has no record — check Supabase directly in case the device was
    // previously registered but the local DB hasn't synced yet (e.g. after logout
    // when PowerSync reconnects and the devices table is briefly stale).
    if (!device) {
      const { data: serverDevice, error: serverDeviceError } = await supabase
        .from('devices')
        .select('device_uid, branch_id, device_name, status, registered_at, last_seen_at')
        .eq('device_uid', deviceUid)
        .maybeSingle<RemoteDeviceRecord>();

      if (serverDeviceError) {
        throw serverDeviceError;
      }

      if (serverDevice) {
        device = mapRemoteDeviceRecord(serverDevice);
      }
    }

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
    captureError(error, { module: 'device', operation: 'getDeviceRegistration', level: 'error' });
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to determine device registration');
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
    `UPDATE devices SET last_seen_at = ? WHERE id = ?`,
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
  const device = await powersync.getOptional<Device>(
    `SELECT * FROM devices WHERE id = ?`, [deviceUid]
  );

  await powersync.execute(
    `UPDATE devices SET status = ? WHERE id = ?`,
    [DEVICE_STATUS.INACTIVE, deviceUid]
  );

  void insertAuditLog({
    action: AUDIT_ACTION.UPDATE,
    tableName: 'devices',
    recordId: device?.id ?? null,
    oldValues: { status: DEVICE_STATUS.ACTIVE },
    newValues: { status: DEVICE_STATUS.INACTIVE },
    description: `Device deactivated: ${deviceUid}`,
  });

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
  const device = await powersync.getOptional<Device>(
    `SELECT * FROM devices WHERE id = ?`, [deviceUid]
  );

  await powersync.execute(
    `UPDATE devices SET status = ?, last_seen_at = ? WHERE id = ?`,
    [DEVICE_STATUS.ACTIVE, new Date().toISOString(), deviceUid]
  );

  void insertAuditLog({
    action: AUDIT_ACTION.UPDATE,
    tableName: 'devices',
    recordId: device?.id ?? null,
    oldValues: { status: DEVICE_STATUS.INACTIVE },
    newValues: { status: DEVICE_STATUS.ACTIVE },
    description: `Device reactivated: ${deviceUid}`,
  });

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
  const device = await powersync.getOptional<Device>(
    `SELECT * FROM devices WHERE id = ?`, [deviceUid]
  );

  await powersync.execute(
    `UPDATE devices SET device_name = ? WHERE id = ?`,
    [newName, deviceUid]
  );

  void insertAuditLog({
    action: AUDIT_ACTION.UPDATE,
    tableName: 'devices',
    recordId: device?.id ?? null,
    oldValues: { device_name: device?.device_name ?? null },
    newValues: { device_name: newName },
    description: `Device renamed: ${deviceUid} → ${newName}`,
  });

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
  deviceId: string
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
  const device = await powersync.getOptional<Device>(
    `SELECT * FROM devices WHERE id = ?`, [deviceUid]
  );

  await powersync.execute(
    `DELETE FROM devices WHERE id = ?`,
    [deviceUid]
  );

  void insertAuditLog({
    action: AUDIT_ACTION.DELETE,
    tableName: 'devices',
    recordId: deviceUid,
    oldValues: { device_name: device?.device_name ?? null },
    description: `Device deleted: ${deviceUid}`,
  });

  console.log('[DeviceService] Deleted device:', deviceUid);
}
