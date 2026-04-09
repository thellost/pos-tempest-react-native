import { Brand, LightThemeColors, ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { type PaperWidth, type PrinterConfig, type PrinterType } from '@/hooks/use-printer';
import {
  getBondedPrinters,
  openBluetoothSettings,
  type DiscoveredPrinter,
  type ScanStatus,
} from '@/lib/bluetooth';
import { printTestPage } from '@/lib/printer';
import { ChefHat, Receipt } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Button, SelectButton } from '@/components/ui';
import { RowDivider } from './primitives';
import { withPressedOpacity } from '@/utils/pressable-style';

const PAPER_WIDTH_PRESETS: PaperWidth[] = [48, 58, 72, 76, 80];

// ── Paper width selector ──────────────────────────────────────────────────────

type PaperWidthSelectorProps = {
  value: PaperWidth;
  placeholderColor: string;
  onChange: (w: PaperWidth) => void;
};

function PaperWidthSelector({ value, placeholderColor, onChange }: PaperWidthSelectorProps) {
  const isCustom = !PAPER_WIDTH_PRESETS.includes(value);
  const [customInput, setCustomInput] = useState(isCustom ? String(value) : '');
  const [showCustom, setShowCustom] = useState(isCustom);

  const handlePreset = (w: PaperWidth) => {
    setShowCustom(false);
    setCustomInput('');
    onChange(w);
  };

  const handleCustomChange = (text: string) => {
    setCustomInput(text);
    const n = parseInt(text, 10);
    if (!isNaN(n) && n >= 24 && n <= 120) onChange(n);
  };

  return (
    <View className="gap-2">
      <Text className="text-pos-xs text-pos-text-muted">Paper Width</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {PAPER_WIDTH_PRESETS.map((w) => (
          <SelectButton
            key={w}
            selected={!showCustom && value === w}
            selectedClassName="border-brand bg-brand"
            unselectedClassName="border-border bg-surface"
            className="rounded-lg px-3 py-2"
            onPress={() => handlePreset(w)}
          >
            <Text className={`text-pos-xs font-semibold ${!showCustom && value === w ? 'text-white' : 'text-pos-text'}`}>
              {w}mm
            </Text>
          </SelectButton>
        ))}
        <SelectButton
          selected={showCustom}
          selectedClassName="border-brand bg-brand"
          unselectedClassName="border-border bg-surface"
          className="rounded-lg px-3 py-2"
          onPress={() => setShowCustom(true)}
        >
          <Text className={`text-pos-xs font-semibold ${showCustom ? 'text-white' : 'text-pos-text'}`}>
            Custom
          </Text>
        </SelectButton>
      </View>
      {showCustom && (
        <View className="flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-pos-sm text-pos-text"
            placeholder="e.g. 68"
            placeholderTextColor={placeholderColor}
            value={customInput}
            onChangeText={handleCustomChange}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text className="text-pos-xs text-pos-text-muted">mm (24–120)</Text>
        </View>
      )}
    </View>
  );
}

// ── Internal printer card ──────────────────────────────────────────────────────

type PrinterCardProps = {
  type: PrinterType;
  label: string;
  icon: LucideIcon;
  address: string | null;
  name: string | null;
  paperWidth: PaperWidth;
  isEditing: boolean;
  isTesting: boolean;
  scanStatus: ScanStatus;
  discoveredPrinters: DiscoveredPrinter[];
  printerAddress: string;
  printerName: string;
  placeholderColor: string;
  onStartEdit: () => void;
  onScan: () => void;
  onSelectPrinter: (p: DiscoveredPrinter) => void;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onTestPrint: () => void;
  onClear: () => void;
  onChangeAddress: (v: string) => void;
  onChangeName: (v: string) => void;
  onChangePaperWidth: (w: PaperWidth) => void;
};

function PrinterCard({
  label,
  icon: Icon,
  address,
  name,
  paperWidth,
  isEditing,
  isTesting,
  scanStatus,
  discoveredPrinters,
  printerAddress,
  printerName,
  placeholderColor,
  onStartEdit,
  onScan,
  onSelectPrinter,
  onSave,
  onCancel,
  onEdit,
  onTestPrint,
  onClear,
  onChangeAddress,
  onChangeName,
  onChangePaperWidth,
}: PrinterCardProps) {
  return (
    <View className="mb-3 overflow-hidden rounded-xl border border-border bg-surface">
      <View className="flex-row items-center justify-between px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <Icon size={14} color={placeholderColor} />
          <Text className="text-pos-xs font-semibold text-pos-text">{label}</Text>
        </View>
        {!isEditing && (
          address ? (
            <View className="flex-row items-center gap-1.5 rounded-md bg-pos-success-muted px-2.5 py-1">
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ThemeColors.success.DEFAULT }} />
              <Text className="text-pos-xs font-medium text-pos-success">Connected</Text>
            </View>
          ) : (
            <View className="rounded-md bg-surface-raised px-2.5 py-1">
              <Text className="text-pos-xs text-pos-text-faint">Not configured</Text>
            </View>
          )
        )}
      </View>

      {isEditing ? (
        <>
          <RowDivider />
          <View className="gap-3 p-3.5">
            <View className="flex-row items-start gap-2.5 rounded-xl border border-pos-warning/35 bg-pos-warning-muted px-3.5 py-3">
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ThemeColors.warning.DEFAULT, marginTop: 3 }} />
              <View className="flex-1">
                <Text className="text-pos-xs font-semibold text-pos-text">Pair your printer first</Text>
                <Text className="mt-0.5 text-pos-xs text-pos-text-muted">
                  Open Bluetooth Settings, pair the printer there, then scan.
                </Text>
                <Pressable
                  onPress={() => openBluetoothSettings()}
                  style={({ pressed }) => withPressedOpacity(pressed, 1, 0.6)}
                >
                  <Text className="mt-1.5 text-pos-xs font-semibold text-brand">
                    Open Bluetooth Settings →
                  </Text>
                </Pressable>
              </View>
            </View>

            <Button
              className="items-center justify-center rounded-xl border border-brand bg-brand-muted py-3"
              onPress={onScan}
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

            {discoveredPrinters.length > 0 && (
              <View className="gap-1.5">
                {discoveredPrinters.map((p) => (
                  <Pressable
                    key={p.target}
                    onPress={() => onSelectPrinter(p)}
                    style={({ pressed }) => withPressedOpacity(pressed)}
                    className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <View className="flex-1">
                      <Text className="text-pos-sm font-semibold text-pos-text">{p.name}</Text>
                      <Text className="mt-0.5 text-pos-xs text-pos-text-muted">{p.target}</Text>
                    </View>
                    <Text className="text-pos-xs font-semibold text-brand">Select</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {scanStatus === 'done' && discoveredPrinters.length === 0 && (
              <Text className="text-center text-pos-xs text-pos-text-muted">
                No paired printers found. Make sure the printer is paired in Bluetooth Settings and powered on.
              </Text>
            )}

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="text-pos-xs text-pos-text-faint">or enter manually</Text>
              <View className="h-px flex-1 bg-border" />
            </View>

            <View>
              <Text className="mb-1.5 text-pos-xs text-pos-text-muted">Bluetooth Address / MAC</Text>
              <TextInput
                className="rounded-xl border border-border bg-surface px-3 py-3 text-pos-sm text-pos-text"
                placeholder="BT:AA:BB:CC:DD:EE:FF"
                placeholderTextColor={placeholderColor}
                value={printerAddress}
                onChangeText={onChangeAddress}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text className="mb-1.5 text-pos-xs text-pos-text-muted">Display Name (optional)</Text>
              <TextInput
                className="rounded-xl border border-border bg-surface px-3 py-3 text-pos-sm text-pos-text"
                placeholder="e.g. Kitchen Epson TM-T20"
                placeholderTextColor={placeholderColor}
                value={printerName}
                onChangeText={onChangeName}
              />
            </View>

            <PaperWidthSelector
              value={paperWidth}
              placeholderColor={placeholderColor}
              onChange={onChangePaperWidth}
            />

            <View className="flex-row gap-2">
              <Button className="flex-1 items-center justify-center rounded-xl bg-brand py-3" onPress={onSave}>
                <Text className="text-center text-pos-sm font-semibold text-white">Save</Text>
              </Button>
              <Button
                className="flex-1 items-center justify-center rounded-xl border border-border bg-surface py-3"
                onPress={onCancel}
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
            <Text className="text-pos-xs text-pos-text-faint">Address</Text>
            <Text className="mt-0.5 text-pos-xs text-pos-text-muted">{address}</Text>
            {name ? <Text className="mt-0.5 text-pos-xs text-pos-text-faint">{name}</Text> : null}
            <Text className="mt-1 text-pos-xs text-pos-text-faint">Paper: {paperWidth}mm</Text>
          </View>
          <RowDivider />
          <View className="gap-2 px-3.5 py-3">
            <PaperWidthSelector
              value={paperWidth}
              placeholderColor={placeholderColor}
              onChange={onChangePaperWidth}
            />
          </View>
          <RowDivider />
          <View className="flex-row gap-2 px-3.5 py-2.5">
            <Button
              className="flex-1 items-center justify-center rounded-lg border border-border bg-surface py-2.5"
              onPress={onEdit}
            >
              <Text className="text-center text-pos-xs text-pos-text">Edit</Text>
            </Button>
            <Button
              className="flex-1 items-center justify-center rounded-lg border border-border bg-surface py-2.5"
              onPress={onTestPrint}
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
              onPress={onClear}
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
              onPress={onStartEdit}
            >
              <Text className="text-center text-pos-sm font-semibold text-brand">+ Add Printer</Text>
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

// ── Exported section ──────────────────────────────────────────────────────────

export type PrinterSectionProps = {
  kitchenPrinter: PrinterConfig | null;
  cashierPrinter: PrinterConfig | null;
  updatePrinter: (type: PrinterType, config: PrinterConfig | null) => Promise<void>;
  updatePrinterPaperWidth: (type: PrinterType, width: PaperWidth) => Promise<void>;
};

export function PrinterSection({
  kitchenPrinter,
  cashierPrinter,
  updatePrinter,
  updatePrinterPaperWidth,
}: PrinterSectionProps) {
  const { isDark } = useAppTheme();
  const C = isDark ? ThemeColors : LightThemeColors;

  const [editingPrinterType, setEditingPrinterType] = useState<PrinterType | null>(null);
  const [printerAddress, setPrinterAddress] = useState('');
  const [printerName, setPrinterName] = useState('');
  const [editingPaperWidth, setEditingPaperWidth] = useState<PaperWidth>(80);
  const [testingPrinter, setTestingPrinter] = useState<PrinterType | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);

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
        paperWidth: editingPaperWidth,
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

  const handleCancel = () => {
    setEditingPrinterType(null);
    setPrinterAddress('');
    setPrinterName('');
    setDiscoveredPrinters([]);
    setScanStatus('idle');
  };

  const handleSave = async () => {
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
        paperWidth: editingPaperWidth,
      });
      setEditingPrinterType(null);
      setPrinterAddress('');
      setPrinterName('');
    } catch {
      Alert.alert('Error', 'Failed to save printer settings.');
    }
  };

  const handleClear = (type: PrinterType) => {
    Alert.alert('Remove Printer', 'Are you sure you want to remove this printer?', [
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
    ]);
  };

  const handleTestPrint = async (type: PrinterType) => {
    setTestingPrinter(type);
    try {
      await printTestPage(type);
      Alert.alert('Test Print', 'Test page sent successfully.');
    } catch {
      Alert.alert('Error', 'Test print failed.');
    } finally {
      setTestingPrinter(null);
    }
  };

  const printers: Array<{ type: PrinterType; label: string; icon: LucideIcon; data: PrinterConfig | null }> = [
    { type: 'kitchen', label: 'Kitchen Printer', icon: ChefHat, data: kitchenPrinter },
    { type: 'cashier', label: 'Cashier / Receipt Printer', icon: Receipt, data: cashierPrinter },
  ];

  return (
    <>
      {printers.map(({ type, label, icon, data }) => (
        <PrinterCard
          key={type}
          type={type}
          label={label}
          icon={icon}
          address={data?.address ?? null}
          name={data?.name ?? null}
          paperWidth={editingPrinterType === type ? editingPaperWidth : (data?.paperWidth ?? 80)}
          isEditing={editingPrinterType === type}
          isTesting={testingPrinter === type}
          scanStatus={scanStatus}
          discoveredPrinters={discoveredPrinters}
          printerAddress={printerAddress}
          printerName={printerName}
          placeholderColor={C.text.faint}
          onStartEdit={() => {
            setEditingPrinterType(type);
            setPrinterAddress('');
            setPrinterName('');
            setEditingPaperWidth(data?.paperWidth ?? 80);
          }}
          onScan={handleStartScan}
          onSelectPrinter={handleSelectPrinter}
          onSave={handleSave}
          onCancel={handleCancel}
          onEdit={() => {
            setEditingPrinterType(type);
            setPrinterAddress(data?.address ?? '');
            setPrinterName(data?.name ?? '');
            setEditingPaperWidth(data?.paperWidth ?? 80);
          }}
          onTestPrint={() => handleTestPrint(type)}
          onClear={() => handleClear(type)}
          onChangeAddress={setPrinterAddress}
          onChangeName={setPrinterName}
          onChangePaperWidth={(w) => {
            if (editingPrinterType === type) {
              setEditingPaperWidth(w);
            } else {
              updatePrinterPaperWidth(type, w).catch(() =>
                Alert.alert('Error', 'Failed to update paper width.'),
              );
            }
          }}
        />
      ))}
    </>
  );
}
