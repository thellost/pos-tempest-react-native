import { Button, SelectButton } from '@/components/ui';
import { LightThemeColors, ThemeColors } from '@/constants/theme';
import type { Branch } from '@/db/models';
import { useAppTheme } from '@/hooks/use-app-theme';
import { updateBranchSchedule } from '@/services/branch.service';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { InfoRow, RowDivider } from './primitives';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

interface BranchScheduleSectionProps {
  branch: Branch | null;
}

export function BranchScheduleSection({ branch }: BranchScheduleSectionProps) {
  const { isDark } = useAppTheme();
  const C = isDark ? ThemeColors : LightThemeColors;

  const [openingTime, setOpeningTime] = useState(branch?.opening_time ?? '08:00');
  const [closingTime, setClosingTime] = useState(branch?.closing_time ?? '22:00');
  const [autoShift, setAutoShift] = useState(branch?.auto_shift ?? false);
  const [saving, setSaving] = useState(false);

  const openingValid = TIME_REGEX.test(openingTime);
  const closingValid = TIME_REGEX.test(closingTime);
  const isValid = openingValid && closingValid;

  const handleSave = async () => {
    if (!branch) return;
    if (!isValid) {
      Alert.alert('Invalid time', 'Times must be in 24h HH:MM format (e.g. 08:00, 22:30).');
      return;
    }
    setSaving(true);
    try {
      await updateBranchSchedule(branch.id, openingTime, closingTime, autoShift);
      Alert.alert('Saved', 'Branch schedule updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save branch schedule.');
    } finally {
      setSaving(false);
    }
  };

  if (!branch) {
    return (
      <View className="items-center py-4">
        <Text className="text-pos-xs text-pos-text-faint">No branch registered on this device.</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {/* Branch name */}
      <View className="overflow-hidden rounded-xl border border-border bg-surface">
        <InfoRow label="Branch" value={branch.name} />
      </View>

      {/* Schedule fields */}
      <View className="overflow-hidden rounded-xl border border-border bg-surface">
        <View className="px-3.5 pb-1.5 pt-3">
          <Text className="text-pos-xs font-semibold uppercase tracking-widest text-pos-text-faint">
            Schedule
          </Text>
          <Text className="mt-0.5 text-pos-xs text-pos-text-faint" numberOfLines={1}>
            Times are in {branch.timezone || 'Asia/Jakarta'}
          </Text>
        </View>

        {/* Auto-shift toggle */}
        <RowDivider />
        <View className="flex-row items-center justify-between px-3.5 py-2.5">
          <View className="flex-1">
            <Text className="text-pos-xs font-medium text-pos-text">Auto-shift</Text>
            <Text className="mt-0.5 text-pos-xs text-pos-text-faint">
              Scheduler opens &amp; closes shifts automatically
            </Text>
          </View>
          <View className="flex-row overflow-hidden rounded-lg border border-border bg-surface-raised p-0.5">
            {(['On', 'Off'] as const).map((label) => {
              const active = label === 'On' ? autoShift : !autoShift;
              return (
                <SelectButton
                  key={label}
                  selected={active}
                  selectedClassName="bg-brand"
                  unselectedClassName="bg-transparent border-transparent"
                  className="rounded-md px-3 py-1"
                  onPress={() => setAutoShift(label === 'On')}
                >
                  <Text
                    className={`text-pos-xs font-semibold ${active ? 'text-white' : 'text-pos-text-muted'}`}
                  >
                    {label}
                  </Text>
                </SelectButton>
              );
            })}
          </View>
        </View>

        {/* Opening time */}
        <RowDivider />
        <View className="flex-row items-center justify-between px-3.5 py-2.5">
          <View className="flex-1">
            <Text className="text-pos-xs font-medium text-pos-text">Opening time</Text>
            <Text className="mt-0.5 text-pos-xs text-pos-text-faint">24h format — HH:MM</Text>
          </View>
          <TextInput
            className={`min-w-[72px] rounded-lg border px-2.5 py-2 text-center text-pos-xs font-medium text-pos-text ${
              openingValid ? 'border-border bg-surface-raised' : 'border-pos-danger bg-pos-danger-muted'
            }`}
            value={openingTime}
            onChangeText={setOpeningTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="HH:MM"
            placeholderTextColor={C.text.faint}
          />
        </View>

        {/* Closing time */}
        <RowDivider />
        <View className="flex-row items-center justify-between px-3.5 py-2.5">
          <View className="flex-1">
            <Text className="text-pos-xs font-medium text-pos-text">Closing time</Text>
            <Text className="mt-0.5 text-pos-xs text-pos-text-faint">24h format — HH:MM</Text>
          </View>
          <TextInput
            className={`min-w-[72px] rounded-lg border px-2.5 py-2 text-center text-pos-xs font-medium text-pos-text ${
              closingValid ? 'border-border bg-surface-raised' : 'border-pos-danger bg-pos-danger-muted'
            }`}
            value={closingTime}
            onChangeText={setClosingTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="HH:MM"
            placeholderTextColor={C.text.faint}
          />
        </View>
      </View>

      {/* Save button */}
      <Button
        className={`items-center justify-center rounded-xl py-3.5 ${
          isValid && !saving ? 'bg-brand' : 'bg-surface-raised'
        }`}
        onPress={handleSave}
        disabled={!isValid || saving}
      >
        <Text
          className={`text-center text-pos-sm font-semibold ${
            isValid && !saving ? 'text-white' : 'text-pos-text-faint'
          }`}
        >
          {saving ? 'Saving…' : 'Save Schedule'}
        </Text>
      </Button>
    </View>
  );
}
