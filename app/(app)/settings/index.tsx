import { DEVICE_STATUS, ROLE_TYPE } from '@/constants/enums';
import { Brand, ThemeColors } from '@/constants/theme';
import { ChefHat, Moon, Receipt, Sun } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { Device } from '@/db/models';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { type PrinterType, usePrinter } from '@/hooks/use-printer';
import { sendToPrinter } from '@/lib/printer';
import {
    deactivateDevice,
    getDevicesByBranch,
    reactivateDevice,
    updateDeviceName,
} from '@/services/device.service';
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
  const { colorScheme, setColorScheme } = useAppTheme();
  const { user } = useAuth();
  const { registration, deviceInfo, refresh: refreshDevice, clearDevice } = useDevice();
  const {
    kitchenPrinter,
    cashierPrinter,
    paperWidth,
    updatePrinter,
    updatePaperWidth,
    isLoading: printerLoading,
  } = usePrinter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Printer editing state
  const [editingPrinterType, setEditingPrinterType] = useState<PrinterType | null>(null);
  const [printerAddress, setPrinterAddress] = useState('');
  const [printerName, setPrinterName] = useState('');
  const [testingPrinter, setTestingPrinter] = useState<PrinterType | null>(null);

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
      
      if (device.device_uid === deviceInfo?.deviceId) {
        await refreshDevice();
      }
    } catch {
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
            } catch {
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
    } catch {
      Alert.alert('Error', 'Failed to reactivate device');
    }
  };

  const handleResetDevice = async () => {
    Alert.alert(
      'Reset Device Registration',
      'Are you sure you want to reset the device registration? This will require re-registering the device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearDevice();
              Alert.alert('Success', 'Device registration has been reset.');
              refreshDevice();
            } catch {
              Alert.alert('Error', 'Failed to reset device registration.');
            }
          },
        },
      ]
    );
  };

  // ── Printer helpers ──────────────────────────────────────────────────────────

  const handleSavePrinter = async () => {
    if (!editingPrinterType) return;
    if (!printerAddress.trim()) {
      Alert.alert('Error', 'Please enter a Bluetooth MAC address or device name.');
      return;
    }
    try {
      await updatePrinter(editingPrinterType, {
        address: printerAddress.trim(),
        name: printerName.trim() || undefined,
        type: editingPrinterType,
      });
      setEditingPrinterType(null);
      setPrinterAddress('');
      setPrinterName('');
    } catch {
      Alert.alert('Error', 'Failed to save printer settings.');
    }
  };

  const handleClearPrinter = (type: PrinterType) => {
    Alert.alert(
      'Remove Printer',
      'Are you sure you want to remove this printer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updatePrinter(type, null);
            } catch {
              Alert.alert('Error', 'Failed to remove printer.');
            }
          },
        },
      ]
    );
  };

  const handleTestPrint = async (type: PrinterType) => {
    setTestingPrinter(type);
    try {
      const testData = `\n== TEST PRINT ==\nPrinter: ${type}\nPOS Tempest\n================\n\n`;
      await sendToPrinter(type, testData);
      Alert.alert('Test Print', 'Test data sent to printer (simulated).\nCheck console log.');
    } catch {
      Alert.alert('Error', 'Test print failed.');
    } finally {
      setTestingPrinter(null);
    }
  };

  const renderPrinterSection = (
    type: PrinterType,
    label: string,
    icon: LucideIcon,
    address: string | null,
    name: string | null,
  ) => {
    const isEditing = editingPrinterType === type;
    const isTesting = testingPrinter === type;

    return (
      <View key={type} className="mb-4 rounded-xl bg-surface-card p-4">
        <View className="mb-3 flex-row items-center gap-2">
          {(() => { const Icon = icon; return <Icon size={18} color={ThemeColors.text.muted} />; })()}
          <Text className="text-pos-sm font-semibold text-pos-text">{label}</Text>
        </View>

        {isEditing ? (
          <View className="gap-3">
            <View>
              <Text className="mb-1 text-pos-xs text-pos-muted">
                Bluetooth Address / MAC
              </Text>
              <TextInput
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-pos-sm text-pos-text"
                placeholder="e.g. 00:11:22:33:44:55"
                placeholderTextColor="#6B7280"
                value={printerAddress}
                onChangeText={setPrinterAddress}
                autoCapitalize="none"
                autoFocus
              />
            </View>
            <View>
              <Text className="mb-1 text-pos-xs text-pos-muted">
                Display Name (optional)
              </Text>
              <TextInput
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-pos-sm text-pos-text"
                placeholder="e.g. Kitchen Epson TM-T20"
                placeholderTextColor="#6B7280"
                value={printerName}
                onChangeText={setPrinterName}
              />
            </View>
            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 rounded-xl bg-brand py-2.5"
                onPress={handleSavePrinter}
              >
                <Text className="text-center text-pos-sm font-semibold text-white">Save</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-xl border border-border bg-surface py-2.5"
                onPress={() => {
                  setEditingPrinterType(null);
                  setPrinterAddress('');
                  setPrinterName('');
                }}
              >
                <Text className="text-center text-pos-sm text-pos-text">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : address ? (
          <>
            <View className="mb-3 rounded-lg bg-surface px-3 py-2.5">
              <Text className="text-pos-xs text-pos-muted">Address</Text>
              <Text className="mt-0.5 text-pos-sm text-pos-text">{address}</Text>
              {name ? (
                <Text className="mt-0.5 text-pos-xs text-pos-muted">{name}</Text>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 rounded-xl border border-border bg-surface py-2"
                onPress={() => {
                  setEditingPrinterType(type);
                  setPrinterAddress(address);
                  setPrinterName(name ?? '');
                }}
              >
                <Text className="text-center text-pos-xs text-pos-text">Edit</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-xl border border-border bg-surface py-2"
                onPress={() => handleTestPrint(type)}
                disabled={isTesting}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={Brand.primary} />
                ) : (
                  <Text className="text-center text-pos-xs text-pos-text">Test Print</Text>
                )}
              </Pressable>
              <Pressable
                className="flex-1 rounded-xl border border-pos-danger/30 bg-pos-danger-muted py-2"
                onPress={() => handleClearPrinter(type)}
              >
                <Text className="text-center text-pos-xs text-pos-danger">Remove</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="flex-row items-center justify-between">
            <Text className="text-pos-sm text-pos-muted">Not configured</Text>
            <Pressable
              className="rounded-xl border border-brand bg-brand-muted px-4 py-2"
              onPress={() => {
                setEditingPrinterType(type);
                setPrinterAddress('');
                setPrinterName('');
              }}
            >
              <Text className="text-pos-xs font-semibold text-brand">+ Add Printer</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderDevice = ({ item }: { item: Device }) => {
    const isCurrentDevice = item.device_uid === deviceInfo?.deviceId;
    const isEditing = editingDeviceId === item.id;

    return (
      <View
        className={`mb-3 rounded-xl border p-4 ${
          isCurrentDevice
            ? 'border-accent bg-accent-muted'
            : item.status === DEVICE_STATUS.INACTIVE
            ? 'border-pos-danger/20 bg-pos-danger-muted'
            : 'border-border bg-surface-card'
        }`}
      >
        {isEditing ? (
          <View className="gap-3">
            <TextInput
              className="rounded-xl border border-border bg-surface p-3 text-pos-base text-pos-text"
              value={editingName}
              onChangeText={setEditingName}
              autoFocus
            />
            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 rounded-xl bg-accent p-3"
                onPress={() => handleRenameDevice(item)}
              >
                <Text className="text-center text-pos-sm font-semibold text-white">Save</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-xl border border-border bg-surface p-3"
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
                <Text className="text-pos-base font-semibold text-pos-text">
                  {item.device_name}
                </Text>
                {isCurrentDevice && (
                  <View className="rounded-md bg-accent-muted px-2 py-0.5">
                    <Text className="text-pos-xs text-accent">This Device</Text>
                  </View>
                )}
                {item.status === DEVICE_STATUS.INACTIVE && (
                  <View className="rounded-md bg-pos-danger-muted px-2 py-0.5">
                    <Text className="text-pos-xs text-pos-danger">Inactive</Text>
                  </View>
                )}
              </View>
            </View>
            
            <Text className="mt-1 text-pos-xs text-pos-text-muted">
              ID: {item.device_uid.slice(0, 8)}...
            </Text>
            
            <Text className="mt-1 text-pos-xs text-pos-text-muted">
              Registered: {new Date(item.registered_at).toLocaleDateString()}
            </Text>
            
            {canManageDevices && (
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  className="rounded-lg border border-border bg-surface px-3 py-1.5"
                  onPress={() => {
                    setEditingDeviceId(item.id);
                    setEditingName(item.device_name);
                  }}
                >
                  <Text className="text-pos-xs text-pos-text">Rename</Text>
                </Pressable>
                
                {item.status === DEVICE_STATUS.ACTIVE ? (
                  <Pressable
                    className="rounded-lg border border-pos-danger/20 bg-pos-danger-muted px-3 py-1.5"
                    onPress={() => handleDeactivateDevice(item)}
                  >
                    <Text className="text-pos-xs text-pos-danger">Deactivate</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    className="rounded-lg border border-pos-success/20 bg-pos-success-muted px-3 py-1.5"
                    onPress={() => handleReactivateDevice(item)}
                  >
                    <Text className="text-pos-xs text-pos-success">Reactivate</Text>
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

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <View className="mb-6">
        <Text className="mb-3 text-pos-lg font-semibold text-pos-text">
          Appearance
        </Text>
        <View className="rounded-xl bg-surface-card p-4">
          <Text className="mb-3 text-pos-sm text-pos-text-muted">Color Theme</Text>
          <View className="flex-row gap-3">
            {(['dark', 'light'] as const).map((scheme) => {
              const active = colorScheme === scheme;
              return (
                <Pressable
                  key={scheme}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3 ${
                    active ? 'border-brand bg-brand' : 'border-border bg-surface'
                  }`}
                  onPress={() => setColorScheme(scheme)}
                >
                  {scheme === 'dark'
                    ? <Moon size={18} color={active ? '#fff' : ThemeColors.text.primary} />
                    : <Sun size={18} color={active ? '#fff' : ThemeColors.text.primary} />
                  }
                  <Text
                    className={`text-pos-sm font-semibold capitalize ${
                      active ? 'text-white' : 'text-pos-text'
                    }`}
                  >
                    {scheme}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View className="mb-6">
        <Text className="mb-3 text-pos-lg font-semibold text-pos-text">
          Current Device
        </Text>
        <View className="rounded-xl bg-surface-card p-4">
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-text-muted">Name:</Text>
              <Text className="text-pos-sm text-pos-text">
                {registration?.device?.device_name || 'Not set'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-text-muted">Branch:</Text>
              <Text className="text-pos-sm text-pos-text">
                {registration?.branch?.name || 'Not set'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-text-muted">Model:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.model || 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-sm text-pos-text-muted">Device ID:</Text>
              <Text className="text-pos-sm text-pos-text">
                {deviceInfo?.deviceId?.slice(0, 8)}...
              </Text>
            </View>
          </View>
        </View>
      </View>

      {canManageDevices && (
        <View className="mb-6">
          <Text className="mb-3 text-pos-lg font-semibold text-pos-text">
            Branch Devices
          </Text>
          
          {devicesLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={Brand.primary} />
            </View>
          ) : devices.length === 0 ? (
            <View className="rounded-xl bg-surface-card p-4">
              <Text className="text-pos-sm text-pos-text-muted">
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

      <View className="mb-6">
        <Text className="mb-3 text-pos-lg font-semibold text-pos-text">
          Printer Settings
        </Text>

        {printerLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator size="small" color={Brand.primary} />
          </View>
        ) : (
          <>
            {/* Paper Width */}
            <View className="mb-4 rounded-xl bg-surface-card p-4">
              <Text className="mb-3 text-pos-sm font-semibold text-pos-text">
                Paper Width
              </Text>
              <View className="flex-row gap-3">
                {(['58mm', '80mm'] as const).map((w) => (
                  <Pressable
                    key={w}
                    className={`flex-1 rounded-xl border py-2.5 ${
                      paperWidth === w
                        ? 'border-brand bg-brand'
                        : 'border-border bg-surface'
                    }`}
                    onPress={() => updatePaperWidth(w)}
                  >
                    <Text
                      className={`text-center text-pos-sm font-semibold ${
                        paperWidth === w ? 'text-white' : 'text-pos-text'
                      }`}
                    >
                      {w}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Kitchen Printer */}
            {renderPrinterSection(
              'kitchen',
              'Kitchen Printer',
              ChefHat,
              kitchenPrinter?.address ?? null,
              kitchenPrinter?.name ?? null,
            )}

            {/* Cashier Printer */}
            {renderPrinterSection(
              'cashier',
              'Cashier / Receipt Printer',
              Receipt,
              cashierPrinter?.address ?? null,
              cashierPrinter?.name ?? null,
            )}
          </>
        )}
      </View>

      <View className="p-4">
        <Text className="mb-4 text-pos-lg font-semibold text-pos-text">
          Device Management
        </Text>

        <Pressable
          className="mb-4 rounded-xl bg-pos-danger p-4"
          onPress={handleResetDevice}
        >
          <Text className="text-center text-pos-base font-semibold text-white">
            Reset Device Registration
          </Text>
        </Pressable>
      </View>

      <View className="rounded-xl bg-surface-card p-4">
        <Text className="text-pos-sm text-pos-text-muted">
          POS Tempest v1.0.0
        </Text>
        <Text className="mt-1 text-pos-xs text-pos-text-faint">
          Offline-first restaurant POS
        </Text>
      </View>
    </ScrollView>
  );
}
