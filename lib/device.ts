/**
 * Device Identity Utilities for POS Tempest
 * Manages unique device identification that persists across app restarts.
 * Each physical POS terminal gets a unique UUID that survives app restarts
 * but is lost on reinstall or manual clear.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';

// Storage key for device ID
const DEVICE_ID_KEY = '@pos_tempest/device_id';
const DEVICE_NAME_KEY = '@pos_tempest/device_name';

/**
 * Device information structure
 */
export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  model: string;
  osVersion: string;
  platform: 'android' | 'ios' | 'web';
}

/**
 * Generates a new UUID v4
 */
async function generateUUID(): Promise<string> {
  // Generate 16 random bytes
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  
  // Set version (4) and variant bits
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Version 4
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Variant 1
  
  // Convert to hex string with hyphens
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Gets or creates a unique device ID.
 * On first launch, generates a UUID and persists it in AsyncStorage.
 * On subsequent calls, returns the stored UUID.
 * 
 * The ID survives app restarts but is lost on:
 * - App uninstall
 * - Manual clear via clearDeviceId()
 * - Device factory reset
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    // Try to get existing device ID
    const existingId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (existingId) {
      console.log('[Device] Found existing device ID:', existingId);
      return existingId;
    }
    
    // Generate new UUID
    const newId = await generateUUID();
    
    // Persist to AsyncStorage
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    
    console.log('[Device] Generated new device ID:', newId);
    return newId;
  } catch (error) {
    console.error('[Device] Error getting/creating device ID:', error);
    // Fallback: generate a temporary ID (won't persist)
    return generateUUID();
  }
}

/**
 * Gets comprehensive device information including the unique ID.
 * Uses expo-device for hardware info.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  try {
    const deviceId = await getOrCreateDeviceId();
    const savedName = await AsyncStorage.getItem(DEVICE_NAME_KEY);
    
    // Get device hardware info
    const model = Device.modelName || Device.modelId || 'Unknown Device';
    const osVersion = Device.osVersion || 'Unknown';
    const platform = Device.osName?.toLowerCase() === 'android' ? 'android' 
      : Device.osName?.toLowerCase() === 'ios' ? 'ios' 
      : 'web';
    
    return {
      deviceId,
      deviceName: savedName || `POS-${deviceId.slice(0, 8)}`,
      model,
      osVersion,
      platform,
    };
  } catch (error) {
    console.error('[Device] Error getting device info:', error);
    
    // Return minimal info on error
    const deviceId = await getOrCreateDeviceId();
    return {
      deviceId,
      deviceName: `POS-${deviceId.slice(0, 8)}`,
      model: 'Unknown',
      osVersion: 'Unknown',
      platform: 'android',
    };
  }
}

/**
 * Updates the friendly device name (e.g., "Kasir 1", "Bar", "Drive-Thru").
 * This is the human-readable name shown in the UI.
 */
export async function setDeviceName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
    console.log('[Device] Updated device name to:', name);
  } catch (error) {
    console.error('[Device] Error setting device name:', error);
    throw error;
  }
}

/**
 * Gets the saved device name (if any).
 */
export async function getDeviceName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DEVICE_NAME_KEY);
  } catch (error) {
    console.error('[Device] Error getting device name:', error);
    return null;
  }
}

/**
 * Clears the device ID and name from storage.
 * Used for admin reset / re-registration.
 * 
 * WARNING: This will cause the device to be treated as "new" on next launch.
 * The device will need to re-register with a branch.
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([DEVICE_ID_KEY, DEVICE_NAME_KEY]);
    console.log('[Device] Cleared device ID and name');
  } catch (error) {
    console.error('[Device] Error clearing device ID:', error);
    throw error;
  }
}

/**
 * Checks if a device ID exists in storage.
 * Useful for determining if this is a fresh install.
 */
export async function hasDeviceId(): Promise<boolean> {
  try {
    const id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    return id !== null;
  } catch (error) {
    console.error('[Device] Error checking device ID:', error);
    return false;
  }
}
