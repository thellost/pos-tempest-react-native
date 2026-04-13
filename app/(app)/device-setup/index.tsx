import { Brand } from '@/constants/theme';
import { useDevice } from '@/hooks/use-device';
import { DeviceInactiveError, DeviceNameTakenError } from '@/services/device.service';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, SelectButton, ShakeField, type ShakeFieldRef } from '@/components/ui';

export default function DeviceSetupScreen() {
  const router = useRouter();
  const { branches, loading, error, registerDevice, deviceInfo, refresh } = useDevice();

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [inactiveDeviceName, setInactiveDeviceName] = useState<string | null>(null);

  const deviceNameRef = useRef<ShakeFieldRef>(null);

  const handleRegister = async () => {
    if (!selectedBranchId) {
      setRegisterError('Please select a branch');
      return;
    }

    if (!deviceName.trim()) {
      setRegisterError('Please enter a device name');
      deviceNameRef.current?.shake();
      return;
    }

    try {
      setRegistering(true);
      setRegisterError(null);

      await registerDevice(selectedBranchId, deviceName.trim());
      router.replace('/(app)/floor');
    } catch (err) {
      if (err instanceof DeviceInactiveError) {
        setInactiveDeviceName(err.device.device_name);
        return;
      }
      if (err instanceof DeviceNameTakenError) {
        setRegisterError(`Device name "${err.deviceName}" is already in use on this branch. Please choose a different name.`);
        return;
      }
      setRegisterError(err instanceof Error ? err.message : 'Failed to register device');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text className="mt-4 text-pos-sm text-pos-text-muted">Loading...</Text>
      </View>
    );
  }

  // Blocked state: device exists in DB but an admin has deactivated it
  if (inactiveDeviceName) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <Text className="text-3xl">🚫</Text>
        </View>
        <Text className="mb-2 text-center text-pos-2xl font-bold text-pos-text">
          Device Deactivated
        </Text>
        <Text className="mb-1 text-center text-pos-base font-semibold text-pos-text">
          {inactiveDeviceName}
        </Text>
        <Text className="mb-8 text-center text-pos-sm text-pos-text-muted">
          This terminal has been deactivated. Please ask your administrator to reactivate it before use.
        </Text>
        <Button
          className="rounded-xl bg-surface-card px-8 py-3"
          onPress={() => setInactiveDeviceName(null)}
        >
          <Text className="text-center text-pos-base font-semibold text-pos-text">Go Back</Text>
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1 p-8"
        contentContainerStyle={{ maxWidth: 600, alignSelf: 'center', width: '100%' }}
      >
        <View className="mb-2 h-14 w-14 items-center justify-center self-center rounded-2xl bg-accent-muted">
          <Text className="text-3xl">📱</Text>
        </View>
        <Text className="mb-2 text-center text-pos-2xl font-bold text-pos-text">
          Device Setup
        </Text>
        <Text className="mb-8 text-center text-pos-base text-pos-text-muted">
          Register this POS terminal to get started
        </Text>

        <View className="mb-6 rounded-xl bg-surface-card p-5">
          <Text className="text-pos-sm font-semibold text-pos-text">
            Device Information
          </Text>
          <View className="mt-3 gap-2">
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-text-muted">Model:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.model || 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-text-muted">OS Version:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.osVersion || 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-text-muted">Device ID:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.deviceId?.slice(0, 8) || 'Unknown'}...
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <Text className="mb-3 text-pos-base font-semibold text-pos-text">
            Select Branch
          </Text>
          {branches.length === 0 ? (
            <View className="rounded-xl bg-pos-warning-muted p-4">
              <Text className="mb-3 text-pos-sm text-pos-warning">
                No branches found. This may happen on first launch while data is syncing. Please wait a moment and tap Refresh.
              </Text>
              <Button
                className="rounded-lg bg-surface-card px-4 py-2"
                onPress={() => {
                  refresh().catch(() => {});
                }}
              >
                <Text className="text-center text-pos-sm font-semibold text-pos-text">
                  Refresh
                </Text>
              </Button>
            </View>
          ) : (
            <View className="gap-2">
              {branches.map((branch) => (
                <SelectButton
                  key={branch.id}
                  selected={selectedBranchId === branch.id}
                  selectedClassName="border-accent bg-accent-muted"
                  unselectedClassName="border-border bg-surface-card"
                  className="rounded-xl p-4"
                  onPress={() => {
                    setSelectedBranchId(branch.id);
                  }}
                >
                  <Text
                    className={`text-pos-base font-semibold ${
                      selectedBranchId === branch.id ? 'text-accent' : 'text-pos-text'
                    }`}
                  >
                    {branch.name}
                  </Text>
                  {branch.address && (
                    <Text className="mt-1 text-pos-sm text-pos-text-muted">
                      {branch.address}
                    </Text>
                  )}
                </SelectButton>
              ))}
            </View>
          )}
        </View>

        <ShakeField ref={deviceNameRef} className="mb-6">
          <Text className="mb-3 text-pos-base font-semibold text-pos-text">
            Device Name
          </Text>
          <TextInput
            className="rounded-xl border border-border bg-surface-card p-4 text-pos-base text-pos-text"
            placeholder="e.g., Kasir 1, Bar, Drive-Thru"
            placeholderTextColor="#64748B"
            value={deviceName}
            onChangeText={(v) => {
              setDeviceName(v);
              if (registerError === 'Please enter a device name') setRegisterError(null);
            }}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text className="mt-2 text-pos-xs text-pos-text-muted">
            Give this terminal a recognizable name for staff identification
          </Text>
        </ShakeField>

        {(error || registerError) && (
          <View className="mb-6 rounded-xl bg-pos-danger-muted p-4">
            <Text className="text-pos-sm text-pos-danger">
              {registerError || error}
            </Text>
          </View>
        )}

        <Button
          className={`rounded-xl p-4 ${
            registering || !selectedBranchId || !deviceName.trim()
              ? 'bg-accent/40'
              : 'bg-accent'
          }`}
          onPress={handleRegister}
          disabled={registering || !selectedBranchId || !deviceName.trim()}
        >
          {registering ? (
            <View className="flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-pos-base font-semibold text-white">
                Registering...
              </Text>
            </View>
          ) : (
            <Text className="text-center text-pos-base font-semibold text-white">
              Register Device
            </Text>
          )}
        </Button>

        <View className="mt-8 rounded-xl bg-surface-card p-4">
          <Text className="text-pos-sm text-pos-text-muted">
            This device will be registered to the selected branch. 
            All orders and shifts will be associated with this device.
            Contact your administrator to change the branch later.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
