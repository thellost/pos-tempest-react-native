/**
 * Device Hook for POS Tempest
 * Provides device identity and registration state to the app.
 * 
 * Usage:
 * - On app launch, check isRegistered to determine if device setup is needed
 * - Use registerDevice() to register the device with a branch
 * - deviceId persists across app restarts (stored in AsyncStorage)
 */

import type { Branch } from '@/db/models';
import {
  clearDeviceId,
  getDeviceInfo,
  getOrCreateDeviceId,
  setDeviceName as setStoredDeviceName,
  type DeviceInfo,
} from '@/lib/device';
import {
  getActiveBranches,
  getDeviceRegistration,
  registerDevice as registerDeviceService,
  updateDeviceLastSeen,
  updateDeviceName as updateDeviceNameService,
  type DeviceRegistrationResult,
} from '@/services/device.service';
import { useCallback, useEffect, useState } from 'react';

/**
 * Device hook return type
 */
type UseDeviceReturn = {
  /** Unique device identifier (UUID) */
  deviceId: string | null;
  /** Device information (model, OS, etc.) */
  deviceInfo: DeviceInfo | null;
  /** Device registration status and details */
  registration: DeviceRegistrationResult | null;
  /** Whether the device is registered and active */
  isRegistered: boolean;
  /** Whether the device data is still loading */
  loading: boolean;
  /** Any error that occurred during device initialization */
  error: string | null;
  /** Available branches for registration */
  branches: Branch[];
  /** Register this device with a branch */
  registerDevice: (branchId: number, deviceName: string) => Promise<void>;
  /** Update the device name */
  updateDeviceName: (newName: string) => Promise<void>;
  /** Refresh device registration status */
  refresh: () => Promise<void>;
  /** Clear device ID (admin function) */
  clearDevice: () => Promise<void>;
};

/**
 * Hook to manage device identity and registration.
 * Must be used after PowerSync is initialized.
 */
export function useDevice(): UseDeviceReturn {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [registration, setRegistration] = useState<DeviceRegistrationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  /**
   * Initialize device ID and check registration status
   */
  const initializeDevice = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get or create device ID
      const id = await getOrCreateDeviceId();
      setDeviceId(id);

      // Get device info
      const info = await getDeviceInfo();
      setDeviceInfo(info);

      // Check registration status
      const regResult = await getDeviceRegistration(id);
      setRegistration(regResult);

      // Load available branches
      const activeBranches = await getActiveBranches();
      setBranches(activeBranches);

      // Update last seen if registered
      if (regResult.registered) {
        await updateDeviceLastSeen(id);
      }

      console.log('[DeviceHook] Initialized device:', id, 'Registered:', regResult.registered);
    } catch (err) {
      console.error('[DeviceHook] Error initializing device:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize device');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Register this device with a branch
   */
  const registerDevice = useCallback(async (branchId: number, deviceName: string) => {
    if (!deviceId) {
      throw new Error('Device ID not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      // Register in database
      const device = await registerDeviceService(deviceId, branchId, deviceName);

      // Update stored device name
      await setStoredDeviceName(deviceName);

      // Refresh registration status
      const regResult = await getDeviceRegistration(deviceId);
      setRegistration(regResult);

      console.log('[DeviceHook] Device registered:', device);
    } catch (err) {
      console.error('[DeviceHook] Error registering device:', err);
      setError(err instanceof Error ? err.message : 'Failed to register device');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  /**
   * Update the device name
   */
  const updateDeviceName = useCallback(async (newName: string) => {
    if (!deviceId) {
      throw new Error('Device ID not initialized');
    }

    try {
      await updateDeviceNameService(deviceId, newName);
      await setStoredDeviceName(newName);

      // Refresh registration
      const regResult = await getDeviceRegistration(deviceId);
      setRegistration(regResult);
    } catch (err) {
      console.error('[DeviceHook] Error updating device name:', err);
      throw err;
    }
  }, [deviceId]);

  /**
   * Refresh device registration status
   */
  const refresh = useCallback(async () => {
    await initializeDevice();
  }, [initializeDevice]);

  /**
   * Clear device ID (admin function)
   */
  const clearDevice = useCallback(async () => {
    try {
      await clearDeviceId();
      setDeviceId(null);
      setDeviceInfo(null);
      setRegistration(null);
      
      // Re-initialize to get new device ID
      await initializeDevice();
    } catch (err) {
      console.error('[DeviceHook] Error clearing device:', err);
      throw err;
    }
  }, [initializeDevice]);

  // Initialize on mount
  useEffect(() => {
    initializeDevice();
  }, [initializeDevice]);

  return {
    deviceId,
    deviceInfo,
    registration,
    isRegistered: registration?.registered ?? false,
    loading,
    error,
    branches,
    registerDevice,
    updateDeviceName,
    refresh,
    clearDevice,
  };
}
