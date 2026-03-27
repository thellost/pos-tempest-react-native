import { LightThemeColors, ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { type EditableConfigKey } from '@/hooks/use-config';
import { Pressable, Text, TextInput, View } from 'react-native';
import { RowDivider } from './primitives';

export type ConfigRow = {
  key: EditableConfigKey;
  label: string;
  hint: string;
  display: string;
  unit: string | null;
  parse: (v: string) => string | number;
  keyboardType: 'numeric' | 'default';
};

export function ConfigSection({
  title,
  rows,
  overrides,
  draft,
  setDraft,
  updateConfig,
  resetConfig,
}: {
  title: string;
  rows: ConfigRow[];
  overrides: Record<string, unknown>;
  draft: Record<string, string>;
  setDraft: (d: Record<string, string>) => void;
  updateConfig: (key: EditableConfigKey, value: string | number) => Promise<void>;
  resetConfig: (key?: EditableConfigKey) => Promise<void>;
}) {
  const { isDark } = useAppTheme();
  const C = isDark ? ThemeColors : LightThemeColors;

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-surface">
      <View className="px-3.5 pb-1.5 pt-3">
        <Text className="text-pos-xs font-semibold uppercase tracking-widest text-pos-text-faint">
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
                <Text className="mt-0.5 text-pos-xs text-pos-text-faint">{row.hint}</Text>
              </View>

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
                  <Text className="w-6 text-pos-xs text-pos-text-faint">{row.unit}</Text>
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
