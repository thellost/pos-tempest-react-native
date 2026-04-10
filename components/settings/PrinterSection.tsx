import { ChefHat, Receipt } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';

import { LightThemeColors, ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { type PaperWidth, type PrinterConfig, type PrinterType } from '@/hooks/use-printer';
import { getBondedPrinters, type DiscoveredPrinter, type ScanStatus } from '@/lib/bluetooth';
import { printTestPage } from '@/lib/printer';

import { PrinterCard } from './PrinterCard';

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
