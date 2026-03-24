import { DEVICE_STATUS, ROLE_TYPE } from '@/constants/enums';
import { Brand, ThemeColors } from '@/constants/theme';
import { AlertTriangle, ChefHat, Moon, Receipt, Sun } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { Device } from '@/db/models';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { type PrinterType, usePrinter } from '@/hooks/use-printer';
import {
    getBondedPrinters,
    openBluetoothSettings,
    type DiscoveredPrinter,
    type ScanStatus,
} from '@/lib/bluetooth';
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
import { Button, SelectButton } from '@/components/ui';

// ── Shared layout primitives ──────────────────────────────────────────────────

function SectionLabel({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <View className="mb-2.5 flex-row items-center gap-1.5 px-1">
      {danger && (
        <AlertTriangle size={11} color={ThemeColors.danger.DEFAULT} />
      )}
      <Text
        className={`text-pos-xs font-semibold uppercase tracking-widest ${
          danger ? 'text-pos-danger' : 'text-pos-muted'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function RowDivider() {
  return <View className="mx-4 h-px bg-border opacity-50" />;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text className="text-pos-sm text-pos-muted">{label}</Text>
      <Text className="text-pos-sm text-pos-text">{value}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

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

  const [editingPrinterType, setEditingPrinterType] = useState<PrinterType | null>(null);
  const [printerAddress, setPrinterAddress] = useState('');
  const [printerName, setPrinterName] = useState('');
  const [testingPrinter, setTestingPrinter] = useState<PrinterType | null>(null);

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);

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

  const handleStartScan = async () => {
    setDiscoveredPrinters([]);
    setScanStatus('scanning');
    const { printers, error } = await getBondedPrinters();
    if (error) {
      Alert.alert('Bluetooth Error', error);
      setScanStatus('error');
    } else {
      setDiscoveredPrinters(printers);
      setScanStatus('done');
    }
  };

  const handleSelectPrinter = async (printer: DiscoveredPrinter) => {
    if (!editingPrinterType) return;
    try {
      await updatePrinter(editingPrinterType, {
        address: printer.target,
        name: printer.name,
        type: editingPrinterType,
      });
      setEditingPrinterType(null);
      setPrinterAddress('');
      setPrinterName('');
      setDiscoveredPrinters([]);
      setScanStatus('idle');
    } catch {
      Alert.alert('Error', 'Failed to save printer settings.');
    }
  };

  const handleCancelEdit = () => {
    setEditingPrinterType(null);
    setPrinterAddress('');
    setPrinterName('');
    setDiscoveredPrinters([]);
    setScanStatus('idle');
  };

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

  // ── Printer card ────────────────────────────────────────────────────────────

  const renderPrinterSection = (
    type: PrinterType,
    label: string,
    icon: LucideIcon,
    address: string | null,
    name: string | null,
  ) => {
    const isEditing = editingPrinterType === type;
    const isTesting = testingPrinter === type;
    const Icon = icon;

    return (
      <View key={type} className="mb-3 overflow-hidden rounded-xl border border-border bg-surface-card">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3.5">
          <View className="flex-row items-center gap-2.5">
            <Icon size={16} color={ThemeColors.text.muted} />
            <Text className="text-pos-sm font-semibold text-pos-text">{label}</Text>
          </View>
          {!isEditing && (
            address ? (
              <View className="flex-row items-center gap-1.5 rounded-md bg-pos-success-muted px-2.5 py-1">
                <View
                  style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ThemeColors.success.DEFAULT }}
                />
                <Text className="text-pos-xs font-medium text-pos-success">Connected</Text>
              </View>
            ) : (
              <View className="rounded-md border border-border bg-surface px-2.5 py-1">
                <Text className="text-pos-xs text-pos-muted">Not configured</Text>
              </View>
            )
          )}
        </View>

        {isEditing ? (
          <>
            <RowDivider />
            <View className="gap-3 p-4">

              {/* ── Pair first notice ── */}
              <View className="flex-row items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3">
                <View className="mt-0.5 h-2 w-2 rounded-full bg-pos-warning" />
                <View className="flex-1">
                  <Text className="text-pos-xs font-semibold text-pos-text">
                    Pair your printer first
                  </Text>
                  <Text className="mt-0.5 text-pos-xs text-pos-muted">
                    Open Bluetooth Settings, pair the printer there, then come back to scan.
                  </Text>
                  <Pressable
                    onPress={() => openBluetoothSettings()}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text className="mt-1.5 text-pos-xs font-semibold text-brand">
                      Open Bluetooth Settings →
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* ── Scan ── */}
              <Button
                className="items-center justify-center rounded-xl border border-brand bg-brand-muted py-3"
                onPress={handleStartScan}
                disabled={scanStatus === 'scanning'}
              >
                {scanStatus === 'scanning' ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color={Brand.primary} />
                    <Text className="text-pos-sm font-semibold text-brand">Scanning…</Text>
                  </View>
                ) : (
                  <Text className="text-pos-sm font-semibold text-brand">
                    {scanStatus === 'idle' ? 'Scan for Paired Printers' : 'Scan Again'}
                  </Text>
                )}
              </Button>

              {/* ── Discovered devices ── */}
              {discoveredPrinters.length > 0 && (
                <View className="gap-1.5">
                  {discoveredPrinters.map((p) => (
                    <Pressable
                      key={p.target}
                      onPress={() => handleSelectPrinter(p)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                    >
                      <View className="flex-1">
                        <Text className="text-pos-sm font-semibold text-pos-text">{p.name}</Text>
                        <Text className="mt-0.5 text-pos-xs text-pos-muted">{p.target}</Text>
                      </View>
                      <Text className="text-pos-xs font-semibold text-brand">Select</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {scanStatus === 'done' && discoveredPrinters.length === 0 && (
                <Text className="text-center text-pos-xs text-pos-muted">
                  No paired printers found. Make sure the printer is paired in Bluetooth Settings and powered on.
                </Text>
              )}

              {/* ── Manual fallback ── */}
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-border opacity-50" />
                <Text className="text-pos-xs text-pos-faint">or enter manually</Text>
                <View className="h-px flex-1 bg-border opacity-50" />
              </View>

              <View>
                <Text className="mb-1.5 text-pos-xs text-pos-muted">Bluetooth Address / MAC</Text>
                <TextInput
                  className="rounded-xl border border-border bg-surface px-3 py-3 text-pos-sm text-pos-text"
                  placeholder="BT:AA:BB:CC:DD:EE:FF"
                  placeholderTextColor={ThemeColors.text.faint}
                  value={printerAddress}
                  onChangeText={setPrinterAddress}
                  autoCapitalize="none"
                />
              </View>
              <View>
                <Text className="mb-1.5 text-pos-xs text-pos-muted">Display Name (optional)</Text>
                <TextInput
                  className="rounded-xl border border-border bg-surface px-3 py-3 text-pos-sm text-pos-text"
                  placeholder="e.g. Kitchen Epson TM-T20"
                  placeholderTextColor={ThemeColors.text.faint}
                  value={printerName}
                  onChangeText={setPrinterName}
                />
              </View>

              <View className="flex-row gap-2">
                <Button
                  className="flex-1 items-center justify-center rounded-xl bg-brand py-3"
                  onPress={handleSavePrinter}
                >
                  <Text className="text-center text-pos-sm font-semibold text-white">Save</Text>
                </Button>
                <Button
                  className="flex-1 items-center justify-center rounded-xl border border-border bg-surface py-3"
                  onPress={handleCancelEdit}
                >
                  <Text className="text-center text-pos-sm text-pos-text">Cancel</Text>
                </Button>
              </View>

            </View>
          </>
        ) : address ? (
          <>
            <RowDivider />
            <View className="px-4 py-3">
              <Text className="text-pos-xs text-pos-muted">Address</Text>
              <Text className="mt-0.5 text-pos-sm text-pos-text">{address}</Text>
              {name ? <Text className="mt-0.5 text-pos-xs text-pos-muted">{name}</Text> : null}
            </View>
            <RowDivider />
            <View className="flex-row gap-2 px-4 py-3">
              <Button
                className="flex-1 items-center justify-center rounded-lg border border-border bg-surface py-2.5"
                onPress={() => {
                  setEditingPrinterType(type);
                  setPrinterAddress(address);
                  setPrinterName(name ?? '');
                }}
              >
                <Text className="text-center text-pos-xs text-pos-text">Edit</Text>
              </Button>
              <Button
                className="flex-1 items-center justify-center rounded-lg border border-border bg-surface py-2.5"
                onPress={() => handleTestPrint(type)}
                disabled={isTesting}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={Brand.primary} />
                ) : (
                  <Text className="text-center text-pos-xs text-pos-text">Test Print</Text>
                )}
              </Button>
              <Button
                className="flex-1 items-center justify-center rounded-lg border border-pos-danger/30 bg-pos-danger-muted py-2.5"
                onPress={() => handleClearPrinter(type)}
              >
                <Text className="text-center text-pos-xs text-pos-danger">Remove</Text>
              </Button>
            </View>
          </>
        ) : (
          <>
            <RowDivider />
            <View className="p-3">
              <Button
                className="items-center justify-center rounded-xl border border-brand bg-brand-muted py-3"
                onPress={() => {
                  setEditingPrinterType(type);
                  setPrinterAddress('');
                  setPrinterName('');
                }}
              >
                <Text className="text-center text-pos-sm font-semibold text-brand">+ Add Printer</Text>
              </Button>
            </View>
          </>
        )}
      </View>
    );
  };

  // ── Device row ──────────────────────────────────────────────────────────────

  const renderDevice = ({ item }: { item: Device }) => {
    const isCurrentDevice = item.device_uid === deviceInfo?.deviceId;
    const isActive = item.status !== DEVICE_STATUS.INACTIVE;
    const isEditing = editingDeviceId === item.id;

    return (
      <View
        className={`mb-2.5 overflow-hidden rounded-xl border ${
          isCurrentDevice
            ? 'border-accent bg-accent-muted'
            : !isActive
            ? 'border-pos-danger/20 bg-pos-danger-muted'
            : 'border-border bg-surface-card'
        }`}
      >
        {isEditing ? (
          <View className="gap-3 p-4">
            <TextInput
              className="rounded-xl border border-border bg-surface p-3 text-pos-base text-pos-text"
              value={editingName}
              onChangeText={setEditingName}
              autoFocus
            />
            <View className="flex-row gap-2">
              <Button
                className="flex-1 items-center justify-center rounded-xl bg-accent p-3"
                onPress={() => handleRenameDevice(item)}
              >
                <Text className="text-center text-pos-sm font-semibold text-white">Save</Text>
              </Button>
              <Button
                className="flex-1 items-center justify-center rounded-xl border border-border bg-surface p-3"
                onPress={() => {
                  setEditingDeviceId(null);
                  setEditingName('');
                }}
              >
                <Text className="text-center text-pos-sm text-pos-text">Cancel</Text>
              </Button>
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isActive
                    ? ThemeColors.success.DEFAULT
                    : ThemeColors.danger.DEFAULT,
                }}
              />
              <View className="flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-pos-sm font-semibold text-pos-text">{item.device_name}</Text>
                  {isCurrentDevice && (
                    <View className="rounded-md bg-accent-muted px-2 py-0.5">
                      <Text className="text-pos-xs text-accent">This device</Text>
                    </View>
                  )}
                  {!isActive && (
                    <View className="rounded-md bg-pos-danger-muted px-2 py-0.5">
                      <Text className="text-pos-xs text-pos-danger">Inactive</Text>
                    </View>
                  )}
                </View>
                <Text className="mt-0.5 text-pos-xs text-pos-muted">
                  {item.device_uid.slice(0, 8)}... · {new Date(item.registered_at).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {canManageDevices && (
              <>
                <View className="mx-4 h-px bg-border opacity-40" />
                <View className="flex-row gap-2 px-4 py-2.5">
                  <Button
                    className="items-center justify-center rounded-lg border border-border bg-surface px-4 py-2"
                    onPress={() => {
                      setEditingDeviceId(item.id);
                      setEditingName(item.device_name);
                    }}
                  >
                    <Text className="text-pos-xs text-pos-text">Rename</Text>
                  </Button>

                  {isActive ? (
                    <Button
                      className="items-center justify-center rounded-lg border border-pos-danger/20 bg-pos-danger-muted px-4 py-2"
                      onPress={() => handleDeactivateDevice(item)}
                    >
                      <Text className="text-pos-xs text-pos-danger">Deactivate</Text>
                    </Button>
                  ) : (
                    <Button
                      className="items-center justify-center rounded-lg border border-pos-success/20 bg-pos-success-muted px-4 py-2"
                      onPress={() => handleReactivateDevice(item)}
                    >
                      <Text className="text-pos-xs text-pos-success">Reactivate</Text>
                    </Button>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </View>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView className="flex-1 bg-surface p-5">

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <View className="mb-6">
        <SectionLabel label="Appearance" />
        <View className="overflow-hidden rounded-xl border border-border bg-surface-card p-1.5">
          <View className="flex-row gap-1">
            {(['dark', 'light'] as const).map((scheme) => {
              const active = colorScheme === scheme;
              return (
                <SelectButton
                  key={scheme}
                  selected={active}
                  selectedClassName="bg-brand"
                  unselectedClassName="bg-transparent"
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3"
                  onPress={() => setColorScheme(scheme)}
                >
                  {scheme === 'dark'
                    ? <Moon size={15} color={active ? '#fff' : ThemeColors.text.muted} />
                    : <Sun size={15} color={active ? '#fff' : ThemeColors.text.muted} />
                  }
                  <Text
                    className={`text-pos-sm font-semibold capitalize ${
                      active ? 'text-white' : 'text-pos-muted'
                    }`}
                  >
                    {scheme}
                  </Text>
                </SelectButton>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── This Device ────────────────────────────────────────────────────── */}
      <View className="mb-6">
        <SectionLabel label="This Device" />
        <View className="overflow-hidden rounded-xl border border-border bg-surface-card">
          <InfoRow
            label="Name"
            value={registration?.device?.device_name || 'Not set'}
          />
          <RowDivider />
          <InfoRow
            label="Branch"
            value={registration?.branch?.name || 'Not set'}
          />
          <RowDivider />
          <InfoRow
            label="Model"
            value={deviceInfo?.model || 'Unknown'}
          />
          <RowDivider />
          <InfoRow
            label="Device ID"
            value={deviceInfo?.deviceId ? `${deviceInfo.deviceId.slice(0, 8)}...` : '—'}
          />
        </View>
      </View>

      {/* ── Branch Devices ─────────────────────────────────────────────────── */}
      {canManageDevices && (
        <View className="mb-6">
          <View className="mb-2.5 flex-row items-center justify-between px-1">
            <Text className="text-pos-xs font-semibold uppercase tracking-widest text-pos-muted">
              Branch Devices
            </Text>
            {devices.length > 0 && (
              <View className="rounded border border-border bg-surface-card px-1.5 py-0.5">
                <Text className="text-pos-xs text-pos-muted">{devices.length}</Text>
              </View>
            )}
          </View>

          {devicesLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={Brand.primary} />
            </View>
          ) : devices.length === 0 ? (
            <View className="rounded-xl border border-border bg-surface-card px-4 py-5">
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

      {/* ── Printers ───────────────────────────────────────────────────────── */}
      <View className="mb-6">
        <SectionLabel label="Printers" />

        {printerLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator size="small" color={Brand.primary} />
          </View>
        ) : (
          <>
            {/* Paper Width */}
            <View className="mb-3 overflow-hidden rounded-xl border border-border bg-surface-card">
              <View className="px-4 pb-1 pt-3.5">
                <Text className="text-pos-xs font-medium text-pos-muted">Paper Width</Text>
              </View>
              <View className="flex-row gap-2 px-4 pb-3.5 pt-2">
                {(['58mm', '80mm'] as const).map((w) => (
                  <SelectButton
                    key={w}
                    selected={paperWidth === w}
                    selectedClassName="border-brand bg-brand"
                    unselectedClassName="border-border bg-surface"
                    className="flex-1 rounded-xl py-2.5"
                    onPress={() => updatePaperWidth(w)}
                  >
                    <Text
                      className={`text-center text-pos-sm font-semibold ${
                        paperWidth === w ? 'text-white' : 'text-pos-text'
                      }`}
                    >
                      {w}
                    </Text>
                  </SelectButton>
                ))}
              </View>
            </View>

            {renderPrinterSection(
              'kitchen',
              'Kitchen Printer',
              ChefHat,
              kitchenPrinter?.address ?? null,
              kitchenPrinter?.name ?? null,
            )}
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

      {/* ── Danger Zone ────────────────────────────────────────────────────── */}
      <View className="mb-6">
        <SectionLabel label="Danger Zone" danger />
        <View className="overflow-hidden rounded-xl border border-pos-danger/20 bg-pos-danger-muted">
          <View className="px-4 pb-3 pt-4">
            <Text className="text-pos-sm font-semibold text-pos-text">
              Reset Device Registration
            </Text>
            <Text className="mt-1 text-pos-xs text-pos-muted">
              Unlinks this device from its branch. Re-registration will be required to continue using the POS.
            </Text>
          </View>
          <View className="mx-4 h-px bg-border opacity-50" />
          <View className="p-3">
            <Button
              className="items-center justify-center rounded-xl bg-pos-danger py-3.5"
              onPress={handleResetDevice}
            >
              <Text className="text-center text-pos-sm font-semibold text-white">
                Reset Registration
              </Text>
            </Button>
          </View>
        </View>
      </View>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <View className="items-center pb-6 pt-2">
        <Text className="text-pos-xs font-medium text-pos-muted">POS Tempest v1.0.0</Text>
        <Text className="mt-1 text-pos-xs text-pos-faint">Offline-first restaurant POS</Text>
      </View>

    </ScrollView>
  );
}
