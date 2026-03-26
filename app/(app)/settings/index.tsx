import { DEVICE_STATUS, ROLE_TYPE } from '@/constants/enums';
import { Brand, LightThemeColors, ThemeColors } from '@/constants/theme';
import { type EditableConfigKey, useConfig } from '@/hooks/use-config';
import {
  AlertTriangle,
  ChefHat,
  ChevronRight,
  Monitor,
  Palette,
  Printer,
  Receipt,
  Moon,
  Settings2,
  Sun,
  Users,
} from 'lucide-react-native';
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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Button, SelectButton } from '@/components/ui';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Config section component ───────────────────────────────────────────────────

type ConfigRow = {
  key: EditableConfigKey;
  label: string;
  hint: string;
  display: string;
  unit: string | null;
  parse: (v: string) => string | number;
  keyboardType: 'numeric' | 'default';
};

function ConfigSection({
  title,
  rows,
  overrides,
  draft,
  setDraft,
  updateConfig,
  resetConfig,
  C,
}: {
  title: string;
  rows: ConfigRow[];
  config: Record<string, unknown>;
  overrides: Record<string, unknown>;
  draft: Record<string, string>;
  setDraft: (d: Record<string, string>) => void;
  updateConfig: (key: EditableConfigKey, value: string | number) => Promise<void>;
  resetConfig: (key?: EditableConfigKey) => Promise<void>;
  C: typeof ThemeColors | typeof LightThemeColors;
}) {
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Sub-header */}
      <View className="px-3.5 pb-1.5 pt-3">
        <Text className="text-pos-xs font-semibold uppercase tracking-widest text-pos-faint">
          {title}
        </Text>
      </View>

      {rows.map((row, i) => {
        const isOverridden = row.key in overrides;
        const draftVal = draft[row.key] ?? row.display;

        const commit = async () => {
          const raw = draft[row.key];
          if (raw === undefined || raw === row.display) return;
          const parsed = row.parse(raw);
          if (parsed !== null && parsed !== undefined && String(parsed).trim() !== '') {
            await updateConfig(row.key, parsed);
          }
        };

        return (
          <View key={row.key}>
            {i > 0 && <RowDivider />}
            <View className="flex-row items-center gap-3 px-3.5 py-2.5">
              {/* Label + hint */}
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-pos-xs font-medium text-pos-text">{row.label}</Text>
                  {isOverridden && (
                    <View className="rounded bg-accent-muted px-1.5 py-0.5">
                      <Text className="text-pos-xs text-accent" style={{ fontSize: 9 }}>
                        custom
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="mt-0.5 text-pos-xs text-pos-faint">{row.hint}</Text>
              </View>

              {/* Input + unit */}
              <View className="flex-row items-center gap-1.5">
                <TextInput
                  className="min-w-[60px] rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-right text-pos-xs font-medium text-pos-text"
                  value={draftVal}
                  onChangeText={(v) => setDraft({ ...draft, [row.key]: v })}
                  onBlur={commit}
                  keyboardType={row.keyboardType}
                  selectTextOnFocus
                  autoCapitalize="none"
                />
                {row.unit && (
                  <Text className="w-6 text-pos-xs text-pos-faint">{row.unit}</Text>
                )}
                {isOverridden && (
                  <Pressable
                    onPress={() => {
                      resetConfig(row.key);
                      const next = { ...draft };
                      delete next[row.key];
                      setDraft(next);
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    hitSlop={8}
                  >
                    <Text style={{ color: C.danger.DEFAULT, fontSize: 10 }}>↺</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function RowDivider() {
  return <View className="h-px bg-border" />;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="text-pos-xs text-pos-muted">{label}</Text>
      <Text className="text-pos-xs font-medium text-pos-text">{value}</Text>
    </View>
  );
}

// ── Accordion section ──────────────────────────────────────────────────────────

function AccordionSection({
  icon: Icon,
  title,
  summary,
  danger = false,
  children,
  defaultOpen = false,
}: {
  icon: LucideIcon;
  title: string;
  summary?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { isDark } = useAppTheme();
  const C = isDark ? ThemeColors : LightThemeColors;

  const [open, setOpen] = useState(defaultOpen);
  const chevron = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    Animated.timing(chevron, {
      toValue: open ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    setOpen((prev) => !prev);
  };

  const rotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View
      className={`mb-2 overflow-hidden rounded-2xl bg-surface-card border ${
        danger ? 'border-pos-danger/20' : 'border-border'
      }`}
    >
      {/* Header */}
      <Pressable
        onPress={toggle}
        style={({ pressed }) => ({ opacity: pressed ? 0.70 : 1 })}
        className="flex-row items-center gap-3 px-4 py-3.5"
      >
        {/* Icon chip */}
        <View
          className={`h-8 w-8 items-center justify-center rounded-xl ${
            danger ? 'bg-pos-danger-muted' : 'bg-accent-muted'
          }`}
        >
          <Icon
            size={15}
            color={danger ? C.danger.DEFAULT : C.accent.primary}
          />
        </View>

        {/* Title */}
        <Text className="flex-1 text-pos-sm font-semibold text-pos-text">
          {title}
        </Text>

        {/* Summary — only shown when collapsed */}
        {summary && !open && (
          <View className="mr-1.5">{summary}</View>
        )}

        {/* Chevron */}
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronRight size={14} color={C.text.faint} />
        </Animated.View>
      </Pressable>

      {/* Content */}
      {open && (
        <>
          <RowDivider />
          <View className="p-4">{children}</View>
        </>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colorScheme, setColorScheme, isDark } = useAppTheme();
  const C = isDark ? ThemeColors : LightThemeColors;
  const { config, overrides, updateConfig, resetConfig } = useConfig();

  // Local draft state for config fields (committed on blur)
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

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

  // Show inactive devices only if the current device is the inactive one
  const visibleDevices = devices.filter((d) => {
    const isCurrentDevice = d.device_uid === deviceInfo?.deviceId;
    const isActive = d.status !== DEVICE_STATUS.INACTIVE;
    return isActive || isCurrentDevice;
  });

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

  // ── Printer card ─────────────────────────────────────────────────────────────

  const renderPrinterCard = (
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
      <View
        key={type}
        className="mb-3 overflow-hidden rounded-xl border border-border bg-surface"
      >
        {/* Sub-header */}
        <View className="flex-row items-center justify-between px-3.5 py-3">
          <View className="flex-row items-center gap-2">
            <Icon size={14} color={C.text.muted} />
            <Text className="text-pos-xs font-semibold text-pos-text">{label}</Text>
          </View>
          {!isEditing && (
            address ? (
              <View className="flex-row items-center gap-1.5 rounded-md bg-pos-success-muted px-2.5 py-1">
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: ThemeColors.success.DEFAULT,
                  }}
                />
                <Text className="text-pos-xs font-medium text-pos-success">
                  Connected
                </Text>
              </View>
            ) : (
              <View className="rounded-md bg-surface-raised px-2.5 py-1">
                <Text className="text-pos-xs text-pos-faint">Not configured</Text>
              </View>
            )
          )}
        </View>

        {isEditing ? (
          <>
            <RowDivider />
            <View className="gap-3 p-3.5">

              {/* Pair first notice */}
              <View className="flex-row items-start gap-2.5 rounded-xl border border-pos-warning/35 bg-pos-warning-muted px-3.5 py-3">
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: ThemeColors.warning.DEFAULT,
                    marginTop: 3,
                  }}
                />
                <View className="flex-1">
                  <Text className="text-pos-xs font-semibold text-pos-text">
                    Pair your printer first
                  </Text>
                  <Text className="mt-0.5 text-pos-xs text-pos-muted">
                    Open Bluetooth Settings, pair the printer there, then scan.
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

              {/* Scan button */}
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

              {/* Discovered devices */}
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

              {/* Manual fallback divider */}
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-border" />
                <Text className="text-pos-xs text-pos-faint">or enter manually</Text>
                <View className="h-px flex-1 bg-border" />
              </View>

              <View>
                <Text className="mb-1.5 text-pos-xs text-pos-muted">Bluetooth Address / MAC</Text>
                <TextInput
                  className="rounded-xl border border-border bg-surface px-3 py-3 text-pos-sm text-pos-text"
                  placeholder="BT:AA:BB:CC:DD:EE:FF"
                  placeholderTextColor={C.text.faint}
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
                  placeholderTextColor={C.text.faint}
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
            <View className="px-3.5 py-3">
              <Text className="text-pos-xs text-pos-faint">Address</Text>
              <Text className="mt-0.5 text-pos-xs text-pos-muted">{address}</Text>
              {name ? (
                <Text className="mt-0.5 text-pos-xs text-pos-faint">{name}</Text>
              ) : null}
            </View>
            <RowDivider />
            <View className="flex-row gap-2 px-3.5 py-2.5">
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
                className="flex-1 items-center justify-center rounded-lg border border-pos-danger/20 bg-pos-danger-muted py-2.5"
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
                <Text className="text-center text-pos-sm font-semibold text-brand">
                  + Add Printer
                </Text>
              </Button>
            </View>
          </>
        )}
      </View>
    );
  };

  // ── Device row ────────────────────────────────────────────────────────────────

  const renderDevice = ({ item }: { item: Device }) => {
    const isCurrentDevice = item.device_uid === deviceInfo?.deviceId;
    const isActive = item.status !== DEVICE_STATUS.INACTIVE;
    const isEditing = editingDeviceId === item.id;

    return (
      <View
        className={`mb-2 overflow-hidden rounded-xl border ${
          isCurrentDevice
            ? 'border-accent/30 bg-accent-muted'
            : !isActive
            ? 'border-pos-danger/20 bg-pos-danger-muted'
            : 'border-border bg-surface'
        }`}
      >
        {isEditing ? (
          <View className="gap-3 p-3.5">
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
            <View className="flex-row items-center gap-3 px-3.5 py-3">
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: isActive
                    ? ThemeColors.success.DEFAULT
                    : ThemeColors.danger.DEFAULT,
                }}
              />
              <View className="flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-pos-xs font-semibold text-pos-text">
                    {item.device_name}
                  </Text>
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
                <Text className="mt-0.5 text-pos-xs text-pos-faint">
                  {item.device_uid.slice(0, 8)}… · {new Date(item.registered_at).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {canManageDevices && (
              <>
                <RowDivider />
                <View className="flex-row gap-2 px-3.5 py-2.5">
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

  // ── Summaries for collapsed headers ──────────────────────────────────────────

  const appearanceSummary = (
    <View className="rounded-lg bg-surface-raised px-2.5 py-1">
      <Text className="text-pos-xs font-medium capitalize text-pos-muted">
        {colorScheme}
      </Text>
    </View>
  );

  const deviceSummary = (
    <Text className="text-pos-xs text-pos-faint" numberOfLines={1}>
      {registration?.device?.device_name ?? '—'}
    </Text>
  );

  const activeDeviceCount = visibleDevices.filter(
    (d) => d.status !== DEVICE_STATUS.INACTIVE
  ).length;
  const devicesSummary = devicesLoading ? null : (
    <View className="rounded-lg bg-surface-raised px-2.5 py-1">
      <Text className="text-pos-xs font-medium text-pos-muted">
        {activeDeviceCount} active
      </Text>
    </View>
  );

  const configuredPrinters = [kitchenPrinter, cashierPrinter].filter(Boolean).length;
  const printerSummary = printerLoading ? null : (
    <View
      className={`rounded-lg px-2.5 py-1 ${
        configuredPrinters > 0 ? 'bg-pos-success-muted' : 'bg-surface-raised'
      }`}
    >
      <Text
        className={`text-pos-xs font-medium ${
          configuredPrinters > 0 ? 'text-pos-success' : 'text-pos-faint'
        }`}
      >
        {configuredPrinters}/2
      </Text>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      {/* Page header */}
      <View className="mb-4 flex-row items-center justify-between px-1">
        <Text className="text-pos-base font-bold text-pos-text">Settings</Text>
        <View className="rounded-lg bg-surface-raised px-2.5 py-1">
          <Text className="text-pos-xs text-pos-faint">POS Tempest v1.0.0</Text>
        </View>
      </View>

      {/* ── Appearance ──────────────────────────────────────────────────────── */}
      <AccordionSection
        icon={Palette}
        title="Appearance"
        summary={appearanceSummary}
      >
        <View className="overflow-hidden rounded-xl border border-border bg-surface-raised p-1.5">
          <View className="flex-row gap-1">
            {(['dark', 'light'] as const).map((scheme) => {
              const active = colorScheme === scheme;
              const ThemeIcon = scheme === 'dark' ? Moon : Sun;
              return (
                <SelectButton
                  key={scheme}
                  selected={active}
                  selectedClassName="bg-brand"
                  unselectedClassName="bg-transparent"
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3"
                  onPress={() => setColorScheme(scheme)}
                >
                  <ThemeIcon
                    size={14}
                    color={active ? '#fff' : C.text.muted}
                  />
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
      </AccordionSection>

      {/* ── This Device ─────────────────────────────────────────────────────── */}
      <AccordionSection
        icon={Monitor}
        title="This Device"
        summary={deviceSummary}
      >
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
          value={
            deviceInfo?.deviceId
              ? `${deviceInfo.deviceId.slice(0, 8)}…`
              : '—'
          }
        />
      </AccordionSection>

      {/* ── Branch Devices ──────────────────────────────────────────────────── */}
      {canManageDevices && (
        <AccordionSection
          icon={Users}
          title="Branch Devices"
          summary={devicesSummary}
        >
          {devicesLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator size="large" color={Brand.primary} />
            </View>
          ) : visibleDevices.length === 0 ? (
            <View className="rounded-xl border border-border bg-surface px-4 py-5">
              <Text className="text-pos-xs text-pos-muted">
                No active devices registered for this branch.
              </Text>
            </View>
          ) : (
            <FlatList
              data={visibleDevices}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          )}
        </AccordionSection>
      )}

      {/* ── Printers ────────────────────────────────────────────────────────── */}
      <AccordionSection
        icon={Printer}
        title="Printers"
        summary={printerSummary}
      >
        {printerLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator size="small" color={Brand.primary} />
          </View>
        ) : (
          <>
            {/* Paper Width */}
            <View className="mb-3 overflow-hidden rounded-xl border border-border bg-surface-raised">
              <View className="px-3.5 pb-1 pt-3">
                <Text className="text-pos-xs font-medium text-pos-muted">Paper Width</Text>
              </View>
              <View className="flex-row gap-2 px-3.5 pb-3 pt-2">
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

            {renderPrinterCard(
              'kitchen',
              'Kitchen Printer',
              ChefHat,
              kitchenPrinter?.address ?? null,
              kitchenPrinter?.name ?? null,
            )}
            {renderPrinterCard(
              'cashier',
              'Cashier / Receipt Printer',
              Receipt,
              cashierPrinter?.address ?? null,
              cashierPrinter?.name ?? null,
            )}
          </>
        )}
      </AccordionSection>

      {/* ── Configuration ───────────────────────────────────────────────────── */}
      {isAdmin && (
        <AccordionSection
          icon={Settings2}
          title="Configuration"
          summary={
            Object.keys(overrides).length > 0 ? (
              <View className="rounded-lg bg-accent-muted px-2.5 py-1">
                <Text className="text-pos-xs font-medium text-accent">
                  {Object.keys(overrides).length} overridden
                </Text>
              </View>
            ) : undefined
          }
        >
          <ConfigSection
            title="Session"
            rows={[
              {
                key: 'IDLE_TIMEOUT_MS',
                label: 'Auto-lock timeout',
                hint: 'Minutes before screen locks',
                display: String(Math.round(config.IDLE_TIMEOUT_MS / 60000)),
                unit: 'min',
                parse: (v) => Math.max(1, Number(v)) * 60000,
                keyboardType: 'numeric',
              },
              {
                key: 'MAX_SESSION_DURATION_HOURS',
                label: 'Max session duration',
                hint: 'Hours before forced re-login',
                display: String(config.MAX_SESSION_DURATION_HOURS),
                unit: 'hr',
                parse: (v) => Math.max(1, Number(v)),
                keyboardType: 'numeric',
              },
            ]}
            config={config}
            overrides={overrides}
            draft={configDraft}
            setDraft={setConfigDraft}
            updateConfig={updateConfig}
            resetConfig={resetConfig}
            C={C}
          />

          <View className="mt-3">
            <ConfigSection
              title="Business"
              rows={[
                {
                  key: 'ORDER_PREFIX',
                  label: 'Order prefix',
                  hint: 'Prepended to every order number',
                  display: config.ORDER_PREFIX,
                  unit: null,
                  parse: (v) => v.trim().toUpperCase(),
                  keyboardType: 'default',
                },
                {
                  key: 'TICKET_PREFIX',
                  label: 'Kitchen ticket prefix',
                  hint: 'Prepended to kitchen ticket numbers',
                  display: config.TICKET_PREFIX,
                  unit: null,
                  parse: (v) => v.trim().toUpperCase(),
                  keyboardType: 'default',
                },
                {
                  key: 'CURRENCY',
                  label: 'Currency code',
                  hint: 'ISO 4217 code e.g. IDR, USD',
                  display: config.CURRENCY,
                  unit: null,
                  parse: (v) => v.trim().toUpperCase(),
                  keyboardType: 'default',
                },
                {
                  key: 'TIMEZONE',
                  label: 'Timezone',
                  hint: 'IANA timezone e.g. Asia/Jakarta',
                  display: config.TIMEZONE,
                  unit: null,
                  parse: (v) => v.trim(),
                  keyboardType: 'default',
                },
              ]}
              config={config}
              overrides={overrides}
              draft={configDraft}
              setDraft={setConfigDraft}
              updateConfig={updateConfig}
              resetConfig={resetConfig}
              C={C}
            />
          </View>

          {Object.keys(overrides).length > 0 && (
            <Button
              className="mt-3 items-center justify-center rounded-xl border border-border bg-surface py-3"
              onPress={() => {
                Alert.alert(
                  'Reset all settings',
                  'Restore all configuration values to their defaults?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset all',
                      style: 'destructive',
                      onPress: () => resetConfig(),
                    },
                  ]
                );
              }}
            >
              <Text className="text-center text-pos-xs text-pos-muted">
                Reset all to defaults
              </Text>
            </Button>
          )}
        </AccordionSection>
      )}

      {/* ── Danger Zone ─────────────────────────────────────────────────────── */}
      <AccordionSection
        icon={AlertTriangle}
        title="Danger Zone"
        danger
      >
        <View className="gap-3">
          <View>
            <Text className="text-pos-sm font-semibold text-pos-text">
              Reset Device Registration
            </Text>
            <Text className="mt-1 text-pos-xs text-pos-muted">
              Unlinks this device from its branch. Re-registration will be required to continue using the POS.
            </Text>
          </View>
          <Button
            className="items-center justify-center rounded-xl bg-pos-danger py-3.5"
            onPress={handleResetDevice}
          >
            <Text className="text-center text-pos-sm font-semibold text-white">
              Reset Registration
            </Text>
          </Button>
        </View>
      </AccordionSection>

    </ScrollView>
  );
}
