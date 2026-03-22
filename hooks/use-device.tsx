/**
 * Device Hook for POS Tempest
 * Provides device identity and registration state to the app.
 * 
 * Usage:
 * - On app launch, check isRegistered to determine if device setup is needed
 * - Use registerDevice() to register the device with a branch
 * - deviceId persists across app restarts (stored in AsyncStorage)
 */

import { useQuery } from '@powersync/react';

import type { Branch } from '@/db/models';
import { initializePowerSync } from '@/db/provider';
import {
  clearDeviceId,
  getDeviceInfo,
  getOrCreateDeviceId,
  setDeviceName as setStoredDeviceName,
  type DeviceInfo,
} from '@/lib/device';
import { addBreadcrumb, captureError, setDeviceContext } from '@/lib/sentry';
import { setAuditDeviceContext } from '@/services/audit.service';
import {
  getDeviceRegistration,
  registerDevice as registerDeviceService,
  updateDeviceLastSeen,
  updateDeviceName as updateDeviceNameService,
  type DeviceRegistrationResult,
} from '@/services/device.service';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Device context value type
 */
type DeviceContextValue = {
  deviceId: string | null;
  deviceInfo: DeviceInfo | null;
  registration: DeviceRegistrationResult | null;
  isRegistered: boolean;
  loading: boolean;
  error: string | null;
  branches: Branch[];
  registerDevice: (branchId: number, deviceName: string) => Promise<void>;
  updateDeviceName: (newName: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearDevice: () => Promise<void>;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

/**
 * Device Provider Component
 * Wrap your app with this to provide device state to all children.
 */
export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [registration, setRegistration] = useState<DeviceRegistrationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reactive query — automatically updates when PowerSync syncs branch data
  const { data: branches } = useQuery<Branch>(
    `SELECT * FROM branches WHERE is_active = 1 ORDER BY name`
  );
  
  // Use ref to track initialization state
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  const initializeDevice = useCallback(async () => {
    // Prevent duplicate calls
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      // Ensure PowerSync is ready before any DB operations
      await initializePowerSync();

      // Get or create device ID
      const id = await getOrCreateDeviceId();

      if (!id) {
        throw new Error('Failed to initialize device: device ID is invalid');
      }

      // Check if component is still mounted before updating state
      if (!mountedRef.current) return;

      setDeviceId(id);
      console.log('[DeviceHook] Initialized device ID:', id);

      // Get device info
      const info = await getDeviceInfo();
      if (!mountedRef.current) return;
      setDeviceInfo(info);

      // Check registration status
      const regResult = await getDeviceRegistration(id);
      if (!mountedRef.current) return;
      setRegistration(regResult);

      // Publish device identity to the audit service so every log entry
      // is automatically tagged with this device's ID and name.
      setAuditDeviceContext(
        regResult.device?.id ?? null,
        regResult.device ? `${regResult.device.device_name} (${id})` : null,
      );

      // Publish device identity to Sentry so every event is tagged with device/branch
      if (regResult.device) {
        setDeviceContext({
          id: regResult.device.id,
          name: regResult.device.device_name,
          uid: id,
          branch_id: regResult.device.branch_id,
        });
      }

      // Update last seen if registered
      if (regResult.registered) {
        await updateDeviceLastSeen(id);
      }

      console.log('[DeviceHook] Initialized device:', id, 'Registered:', regResult.registered);
    } catch (err) {
      captureError(err, { module: 'device', operation: 'initializeDevice', level: 'error' });
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to initialize device');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      initializingRef.current = false;
    }
  }, []);

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
      addBreadcrumb('device', 'Device registered', { deviceId, branchId, deviceName });
      console.log('[DeviceHook] Device registered:', device);
    } catch (err) {
      captureError(err, { module: 'device', operation: 'registerDevice', level: 'error' });
      setError(err instanceof Error ? err.message : 'Failed to register device');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

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
      captureError(err, { module: 'device', operation: 'updateDeviceName', level: 'error' });
      throw err;
    }
  }, [deviceId]);

  const refresh = useCallback(async () => {
    initializingRef.current = false;
    await initializeDevice();
  }, [initializeDevice]);

  const clearDevice = useCallback(async () => {
    try {
      await clearDeviceId();
      // Set loading=true first so the layout shows the loading screen instead of
      // redirecting to device-setup during the async gap before initializeDevice
      // can set loading=true itself.
      setLoading(true);
      setDeviceId(null);
      setDeviceInfo(null);
      setRegistration(null);
      initializingRef.current = false;
      
      // Re-initialize to get new device ID
      await initializeDevice();
    } catch (err) {
      captureError(err, { module: 'device', operation: 'clearDevice', level: 'error' });
      throw err;
    }
  }, [initializeDevice]);

  // Initialize on mount only
  useEffect(() => {
    mountedRef.current = true;
    initializeDevice();
    
    return () => {
      mountedRef.current = false;
    };
  }, [initializeDevice]);

  const value = useMemo<DeviceContextValue>(() => ({
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
  }), [deviceId, deviceInfo, registration, loading, error, branches, registerDevice, updateDeviceName, refresh, clearDevice]);

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

/**
 * Hook to access device identity and registration.
 * Must be used within a DeviceProvider.
 */
export function useDevice(): DeviceContextValue {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}
