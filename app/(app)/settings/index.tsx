/**
 * Settings Screen
 * Branch config, printer pairing, and device management.
 */

import { DEVICE_STATUS, ROLE_TYPE } from '@/constants/enums';
import { Brand } from '@/constants/theme';
import type { Device } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import {
  deactivateDevice,
  getDevicesByBranch,
  reactivateDevice,
  updateDeviceName,
} from '@/services/device.service';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { registration, deviceInfo, refresh: refreshDevice, clearDevice } = useDevice();
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const isAdmin = user?.role_name === ROLE_TYPE.ADMIN;
  const isManager = user?.role_name === ROLE_TYPE.MANAGER;
  const canManageDevices = isAdmin || isManager;

  const loadDevices = useCallback(async () => {
    if (!registration?.branch?.id) return;
    
    try {
      setDevicesLoading(true);
      const branchDevices = await getDevicesByBranch(registration.branch.id);
      setDevices(branchDevices);
    } catch (error) {
      console.error('[Settings] Error loading devices:', error);
    } finally {
      setDevicesLoading(false);
    }
  }, [registration?.branch?.id]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleRenameDevice = async (device: Device) => {
    if (!editingName.trim()) {
      Alert.alert('Error', 'Please enter a device name');
      return;
    }
    
    try {
      await updateDeviceName(device.device_uid, editingName.trim());
      await loadDevices();
      setEditingDeviceId(null);
      setEditingName('');
      
      // Refresh device hook if this is the current device
      if (device.device_uid === deviceInfo?.deviceId) {
        await refreshDevice();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update device name');
    }
  };

  const handleDeactivateDevice = async (device: Device) => {
    Alert.alert(
      'Deactivate Device',
      `Are you sure you want to deactivate "${device.device_name}"? This device will need to re-register to use the POS.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateDevice(device.device_uid);
              await loadDevices();
            } catch (error) {
              Alert.alert('Error', 'Failed to deactivate device');
            }
          },
        },
      ]
    );
  };

  const handleReactivateDevice = async (device: Device) => {
    try {
      await reactivateDevice(device.device_uid);
      await loadDevices();
    } catch (error) {
      Alert.alert('Error', 'Failed to reactivate device');
    }
  };

  const handleClearDevice = () => {
    Alert.alert(
      'Reset Device',
      'This will clear the device registration and generate a new device ID. You will need to re-register this device. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearDevice();
              router.replace('/(app)/device-setup');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset device');
            }
          },
        },
      ]
    );
  };

  const renderDevice = ({ item }: { item: Device }) => {
    const isCurrentDevice = item.device_uid === deviceInfo?.deviceId;
    const isEditing = editingDeviceId === item.id;

    return (
      <View
        className={`mb-3 rounded-lg border p-4 ${
          isCurrentDevice
            ? 'border-brand bg-brand/5'
            : item.status === DEVICE_STATUS.INACTIVE
            ? 'border-red-500/20 bg-red-500/5'
            : 'border-white/10 bg-surface-soft'
        }`}
      >
        {isEditing ? (
          <View className="gap-3">
            <TextInput
              className="rounded-lg border border-white/10 bg-surface p-3 text-pos-base text-pos-text"
              value={editingName}
              onChangeText={setEditingName}
              autoFocus
            />
            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 rounded-lg bg-brand p-2"
                onPress={() => handleRenameDevice(item)}
              >
                <Text className="text-center text-pos-sm font-semibold text-white">Save</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-lg border border-white/10 bg-surface p-2"
                onPress={() => {
                  setEditingDeviceId(null);
                  setEditingName('');
                }}
              >
                <Text className="text-center text-pos-sm text-pos-text">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="text-pos-base font-semibold text-pos-text-strong">
                  {item.device_name}
                </Text>
                {isCurrentDevice && (
                  <View className="rounded bg-brand/20 px-2 py-0.5">
                    <Text className="text-pos-xs text-brand">This Device</Text>
                  </View>
                )}
                {item.status === DEVICE_STATUS.INACTIVE && (
                  <View className="rounded bg-red-500/20 px-2 py-0.5">
                    <Text className="text-pos-xs text-red-400">Inactive</Text>
                  </View>
                )}
              </View>
            </View>
            
            <Text className="mt-1 text-pos-xs text-pos-muted">
              ID: {item.device_uid.slice(0, 8)}...
            </Text>
            
            <Text className="mt-1 text-pos-xs text-pos-muted">
              Registered: {new Date(item.registered_at).toLocaleDateString()}
            </Text>
            
            {canManageDevices && (
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  className="rounded-lg border border-white/10 bg-surface px-3 py-1.5"
                  onPress={() => {
                    setEditingDeviceId(item.id);
                    setEditingName(item.device_name);
                  }}
                >
                  <Text className="text-pos-xs text-pos-text">Rename</Text>
                </Pressable>
                
                {item.status === DEVICE_STATUS.ACTIVE ? (
                  <Pressable
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5"
                    onPress={() => handleDeactivateDevice(item)}
                  >
                    <Text className="text-pos-xs text-red-400">Deactivate</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5"
                    onPress={() => handleReactivateDevice(item)}
                  >
                    <Text className="text-pos-xs text-green-400">Reactivate</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <ScrollView className="flex-1 bg-surface p-6">
      {/* Current Device Info */}
      <View className="mb-6">
        <Text className="mb-3 text-pos-lg font-semibold text-pos-text-strong">
          Current Device
        </Text>
        <View className="rounded-lg bg-surface-soft p-4">
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Name:</Text>
              <Text className="text-pos-sm text-pos-text">
                {registration?.device?.device_name || 'Not set'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Branch:</Text>
              <Text className="text-pos-sm text-pos-text">
                {registration?.branch?.name || 'Not set'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Model:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.model || 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Device ID:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.deviceId?.slice(0, 8)}...
              </Text>
            </View>
          </View>
          
          {isAdmin && (
            <Pressable
              className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3"
              onPress={handleClearDevice}
            >
              <Text className="text-center text-pos-sm font-semibold text-red-400">
                Reset Device Registration
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Branch Devices */}
      {canManageDevices && (
        <View className="mb-6">
          <Text className="mb-3 text-pos-lg font-semibold text-pos-text-strong">
            Branch Devices
          </Text>
          
          {devicesLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={Brand.primary} />
            </View>
          ) : devices.length === 0 ? (
            <View className="rounded-lg bg-surface-soft p-4">
              <Text className="text-pos-sm text-pos-muted">
                No devices registered for this branch.
              </Text>
            </View>
          ) : (
            <FlatList
              data={devices}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          )}
        </View>
      )}

      {/* Printer Settings (Placeholder) */}
      <View className="mb-6">
        <Text className="mb-3 text-pos-lg font-semibold text-pos-text-strong">
          Printer Settings
        </Text>
        <View className="rounded-lg bg-surface-soft p-4">
          <Text className="text-pos-sm text-pos-muted">
            Printer configuration will be available in Step 9.
          </Text>
        </View>
      </View>

      {/* App Info */}
      <View className="rounded-lg bg-surface-soft p-4">
        <Text className="text-pos-sm text-pos-muted">
          POS Tempest v1.0.0
        </Text>
        <Text className="mt-1 text-pos-xs text-pos-muted">
          Offline-first restaurant POS
        </Text>
      </View>
    </ScrollView>
  );
}
