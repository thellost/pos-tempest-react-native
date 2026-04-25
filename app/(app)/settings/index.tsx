import { AccordionSection } from '@/components/settings/AccordionSection';
import { BranchScheduleSection } from '@/components/settings/BranchScheduleSection';
import { ConfigSection, type ConfigRow } from '@/components/settings/ConfigSection';
import { DeviceList } from '@/components/settings/DeviceList';
import { InfoRow, RowDivider } from '@/components/settings/primitives';
import { PrinterSection } from '@/components/settings/PrinterSection';
import { Button, SelectButton } from '@/components/ui';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { PERMISSION } from '@/constants/permissions';
import { Config } from '@/constants/config';
import { Brand } from '@/constants/theme';
import { resetLocalData } from '@/db/provider';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/hooks/use-auth';
import { useConfig } from '@/hooks/use-config';
import { useDevice } from '@/hooks/use-device';
import { updateBranchRoundingPrecision } from '@/services/branch.service';
import { usePrinter } from '@/hooks/use-printer';
import Constants from 'expo-constants';
import {
  AlertTriangle,
  Clock,
  Monitor,
  Moon,
  Palette,
  Printer,
  Settings2,
  Sun,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, UIManager, View } from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useAppTheme();
  const { signOut } = useAuth();
  const { config, overrides, updateConfig, resetConfig } = useConfig();
  const { registration, deviceInfo, refresh: refreshDevice, clearDevice } = useDevice();
  const {
    kitchenPrinter,
    cashierPrinter,
    updatePrinter,
    updatePrinterPaperWidth,
    isLoading: printerLoading,
  } = usePrinter();

  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [isResettingLocalData, setIsResettingLocalData] = useState(false);
  const [roundingPrecision, setRoundingPrecision] = useState<number>(
    (registration?.branch?.rounding_precision as number) ?? Config.DEFAULT_ROUNDING_PRECISION,
  );
  const [savingRounding, setSavingRounding] = useState(false);

  async function handleRoundingChange(value: number) {
    const branchId = registration?.branch?.id;
    if (!branchId) return;
    setRoundingPrecision(value);
    setSavingRounding(true);
    try {
      await updateBranchRoundingPrecision(branchId as number, value);
    } catch {
      Alert.alert('Error', 'Failed to update rounding precision');
      setRoundingPrecision(
        (registration?.branch?.rounding_precision as number) ?? Config.DEFAULT_ROUNDING_PRECISION,
      );
    } finally {
      setSavingRounding(false);
    }
  }

  const handleResetLocalData = () => {
    Alert.alert(
      'Reset Local Data?',
      'This will erase all locally stored orders, shifts, menus, and other cached data, then sign you out. Make sure all open shifts are closed and all orders have synced. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsResettingLocalData(true);
            let resetError: unknown = null;
            try {
              await resetLocalData();
            } catch (error) {
              resetError = error;
              console.error('[Settings] resetLocalData failed:', error);
            }
            try {
              await signOut();
            } catch (error) {
              console.error('[Settings] signOut after reset failed:', error);
            } finally {
              setIsResettingLocalData(false);
            }
            if (resetError) {
              const message = resetError instanceof Error ? resetError.message : 'Unknown error';
              Alert.alert(
                'Reset Incomplete',
                `Local data may not be fully cleared: ${message}\n\nYou have been signed out. Please reopen the app to retry.`,
              );
            }
          },
        },
      ],
    );
  };

  const handleResetDevice= () => {
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

  // ── Accordion summaries ────────────────────────────────────────────────────

  const appearanceSummary = (
    <View className="rounded-lg bg-surface-raised px-2.5 py-1">
      <Text className="text-pos-xs font-medium capitalize text-pos-text-muted">{colorScheme}</Text>
    </View>
  );

  const deviceSummary = (
    <Text className="text-pos-xs text-pos-text-faint" numberOfLines={1}>
      {registration?.device?.device_name ?? '—'}
    </Text>
  );

  const configuredPrinters = [kitchenPrinter, cashierPrinter].filter(Boolean).length;
  const printerSummary = printerLoading ? null : (
    <View className={`rounded-lg px-2.5 py-1 ${configuredPrinters > 0 ? 'bg-pos-success-muted' : 'bg-surface-raised'}`}>
      <Text className={`text-pos-xs font-medium ${configuredPrinters > 0 ? 'text-pos-success' : 'text-pos-text-faint'}`}>
        {configuredPrinters}/2
      </Text>
    </View>
  );

  const overrideCount = Object.keys(overrides).length;
  const configSummary = overrideCount > 0 ? (
    <View className="rounded-lg bg-accent-muted px-2.5 py-1">
      <Text className="text-pos-xs font-medium text-accent">{overrideCount} overridden</Text>
    </View>
  ) : undefined;

  // ── Config rows ────────────────────────────────────────────────────────────

  const sessionRows: ConfigRow[] = [
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
  ];

  const businessRows: ConfigRow[] = [
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
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <View className="mb-4 flex-row items-center justify-between px-1">
        <Text className="text-pos-base font-bold text-pos-text">Settings</Text>
        <View className="rounded-lg bg-surface-raised px-2.5 py-1">
          <Text className="text-pos-xs text-pos-text-faint">POS Tempest v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </View>

      {/* Appearance */}
      <AccordionSection icon={Palette} title="Appearance" summary={appearanceSummary}>
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
                  <ThemeIcon size={14} color={active ? '#fff' : Brand.primary} />
                  <Text className={`text-pos-sm font-semibold capitalize ${active ? 'text-white' : 'text-pos-text-muted'}`}>
                    {scheme}
                  </Text>
                </SelectButton>
              );
            })}
          </View>
        </View>
      </AccordionSection>

      {/* This Device */}
      <AccordionSection icon={Monitor} title="This Device" summary={deviceSummary}>
        <InfoRow label="Name" value={registration?.device?.device_name || 'Not set'} />
        <RowDivider />
        <InfoRow label="Branch" value={registration?.branch?.name || 'Not set'} />
        <RowDivider />
        <InfoRow label="Model" value={deviceInfo?.model || 'Unknown'} />
        <RowDivider />
        <InfoRow
          label="Device ID"
          value={deviceInfo?.deviceId ? `${deviceInfo.deviceId.slice(0, 8)}…` : '—'}
        />
      </AccordionSection>

      {/* Branch Schedule */}
      <PermissionGate permission={PERMISSION.BRANCH_SETTINGS}>
        <AccordionSection icon={Clock} title="Branch Schedule">
          <BranchScheduleSection branch={registration?.branch ?? null} />
        </AccordionSection>
      </PermissionGate>

      {/* Branch Devices */}
      <PermissionGate permission={PERMISSION.BRANCH_SETTINGS}>
        <AccordionSection icon={Users} title="Branch Devices">
          <DeviceList canManageDevices />
        </AccordionSection>
      </PermissionGate>

      {/* Printers */}
      <PermissionGate permission={PERMISSION.PRINTER_SETTINGS}>
        <AccordionSection icon={Printer} title="Printers" summary={printerSummary}>
          <PrinterSection
            kitchenPrinter={kitchenPrinter}
            cashierPrinter={cashierPrinter}
            updatePrinter={updatePrinter}
            updatePrinterPaperWidth={updatePrinterPaperWidth}
          />
        </AccordionSection>
      </PermissionGate>

      {/* Configuration */}
      <PermissionGate permission={PERMISSION.SYSTEM_CONFIG}>
        <AccordionSection icon={Settings2} title="Configuration" summary={configSummary}>
          <ConfigSection
            title="Session"
            rows={sessionRows}
            overrides={overrides}
            draft={configDraft}
            setDraft={setConfigDraft}
            updateConfig={updateConfig}
            resetConfig={resetConfig}
          />
          <View className="mt-3">
            <ConfigSection
              title="Business"
              rows={businessRows}
              overrides={overrides}
              draft={configDraft}
              setDraft={setConfigDraft}
              updateConfig={updateConfig}
              resetConfig={resetConfig}
            />
          </View>
          <View className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            <View className="px-3.5 pb-1.5 pt-3">
              <Text className="text-pos-xs font-semibold uppercase tracking-widest text-pos-text-faint">
                Rounding
              </Text>
              <Text className="mt-0.5 text-pos-xs text-pos-text-faint" numberOfLines={2}>
                Order totals are rounded to the nearest value
              </Text>
            </View>
            <RowDivider />
            <View className="flex-row items-center gap-2 px-3.5 py-2.5">
              {Config.ROUNDING_PRECISION_OPTIONS.map((opt) => {
                const active = roundingPrecision === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleRoundingChange(opt.value)}
                    disabled={savingRounding}
                    className={`flex-1 items-center rounded-lg border py-2 ${
                      active ? 'border-brand bg-brand' : 'border-border bg-surface-raised'
                    }`}
                    style={savingRounding ? { opacity: 0.5 } : undefined}
                  >
                    <Text
                      className={`text-pos-xs font-bold ${active ? 'text-white' : 'text-pos-text-muted'}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {overrideCount > 0 && (
            <Button
              className="mt-3 items-center justify-center rounded-xl border border-border bg-surface py-3"
              onPress={() => {
                Alert.alert('Reset all settings', 'Restore all configuration values to their defaults?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset all', style: 'destructive', onPress: () => resetConfig() },
                ]);
              }}
            >
              <Text className="text-center text-pos-xs text-pos-text-muted">Reset all to defaults</Text>
            </Button>
          )}
        </AccordionSection>
      </PermissionGate>

      {/* Local Data — available to any signed-in user (waiters included) so a
          stuck terminal can be self-recovered after a backend schema migration. */}
      <PermissionGate permission={PERMISSION.BASIC_SETTINGS}>
        <AccordionSection icon={AlertTriangle} title="Danger Zone" danger>
          <View className="gap-3">
            <View>
              <Text className="text-pos-sm font-semibold text-pos-text">Reset Local Data & Sign Out</Text>
              <Text className="mt-1 text-pos-xs text-pos-text-muted">
                Wipes all locally cached data (orders, shifts, menus) on this device and signs you out. Device registration and printer settings are kept. Use this once after a backend schema migration.
              </Text>
            </View>
            <Button
              className="items-center justify-center rounded-xl bg-pos-danger py-3.5"
              onPress={handleResetLocalData}
              disabled={isResettingLocalData}
            >
              <Text className="text-center text-pos-sm font-semibold text-white">
                {isResettingLocalData ? 'Resetting…' : 'Reset Local Data & Sign Out'}
              </Text>
            </Button>
          </View>
        </AccordionSection>
      </PermissionGate>

      {/* Device Registration — admin/manager only. Re-registration changes the
          device's branch binding and has business impact. */}
      <PermissionGate permission={PERMISSION.BRANCH_SETTINGS}>
        <AccordionSection icon={AlertTriangle} title="Device" danger>
          <View className="gap-3">
            <View>
              <Text className="text-pos-sm font-semibold text-pos-text">Reset Device Registration</Text>
              <Text className="mt-1 text-pos-xs text-pos-text-muted">
                Unlinks this device from its branch. Re-registration will be required to continue using the POS.
              </Text>
            </View>
            <Button
              className="items-center justify-center rounded-xl bg-pos-danger py-3.5"
              onPress={handleResetDevice}
            >
              <Text className="text-center text-pos-sm font-semibold text-white">Reset Registration</Text>
            </Button>
          </View>
        </AccordionSection>
      </PermissionGate>
    </ScrollView>
  );
}
