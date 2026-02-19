/**
 * Device Setup Screen
 * Shown on first launch or when device is not registered.
 * Allows user to select a branch and name the device.
 */

import { Brand } from '@/constants/theme';
import { useDevice } from '@/hooks/use-device';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View
} from 'react-native';

export default function DeviceSetupScreen() {
  const router = useRouter();
  const { branches, loading, error, registerDevice, deviceInfo } = useDevice();
  
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!selectedBranchId) {
      setRegisterError('Please select a branch');
      return;
    }
    
    if (!deviceName.trim()) {
      setRegisterError('Please enter a device name');
      return;
    }
    
    try {
      setRegistering(true);
      setRegisterError(null);
      
      await registerDevice(selectedBranchId, deviceName.trim());
      
      // Navigate to main app
      router.replace('/(app)/floor');
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Failed to register device');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text className="mt-4 text-pos-sm text-pos-muted">Loading...</Text>
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
        {/* Header */}
        <View className="mb-8">
          <Text className="text-pos-2xl font-bold text-pos-text-strong">
            Device Setup
          </Text>
          <Text className="mt-2 text-pos-base text-pos-muted">
            Register this POS terminal to get started
          </Text>
        </View>

        {/* Device Info */}
        <View className="mb-6 rounded-lg bg-surface-soft p-4">
          <Text className="text-pos-sm font-semibold text-pos-text-strong">
            Device Information
          </Text>
          <View className="mt-3 gap-2">
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Model:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.model || 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">OS Version:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.osVersion || 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Device ID:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.deviceId?.slice(0, 8) || 'Unknown'}...
              </Text>
            </View>
          </View>
        </View>

        {/* Branch Selection */}
        <View className="mb-6">
          <Text className="mb-3 text-pos-base font-semibold text-pos-text-strong">
            Select Branch
          </Text>
          {branches.length === 0 ? (
            <View className="rounded-lg bg-yellow-500/10 p-4">
              <Text className="text-pos-sm text-yellow-400">
                No branches available. Please sync with the server or contact your administrator.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  className={`rounded-lg border p-4 ${
                    selectedBranchId === branch.id
                      ? 'border-brand bg-brand/10'
                      : 'border-white/10 bg-surface-soft'
                  }`}
                  onPress={() => setSelectedBranchId(branch.id)}
                >
                  <Text
                    className={`text-pos-base font-semibold ${
                      selectedBranchId === branch.id ? 'text-brand' : 'text-pos-text-strong'
                    }`}
                  >
                    {branch.name}
                  </Text>
                  {branch.address && (
                    <Text className="mt-1 text-pos-sm text-pos-muted">
                      {branch.address}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Device Name Input */}
        <View className="mb-6">
          <Text className="mb-3 text-pos-base font-semibold text-pos-text-strong">
            Device Name
          </Text>
          <TextInput
            className="rounded-lg border border-white/10 bg-surface-soft p-4 text-pos-base text-pos-text"
            placeholder="e.g., Kasir 1, Bar, Drive-Thru"
            placeholderTextColor="#64748b"
            value={deviceName}
            onChangeText={setDeviceName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text className="mt-2 text-pos-xs text-pos-muted">
            Give this terminal a recognizable name for staff identification
          </Text>
        </View>

        {/* Error Messages */}
        {(error || registerError) && (
          <View className="mb-6 rounded-lg bg-red-500/10 p-4">
            <Text className="text-pos-sm text-red-400">
              {registerError || error}
            </Text>
          </View>
        )}

        {/* Register Button */}
        <Pressable
          className={`rounded-lg p-4 ${
            registering || !selectedBranchId || !deviceName.trim()
              ? 'bg-brand/50'
              : 'bg-brand'
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
        </Pressable>

        {/* Help Text */}
        <View className="mt-8 rounded-lg bg-surface-soft p-4">
          <Text className="text-pos-sm text-pos-muted">
            💡 This device will be registered to the selected branch. 
            All orders and shifts will be associated with this device.
            Contact your administrator to change the branch later.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
