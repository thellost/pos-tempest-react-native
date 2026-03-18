import { useQuery } from '@powersync/react';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { toInt } from '@/utils/coerce';

import type { KotStatus } from '@/constants/enums';
import { KOT_STATUS, ORDER_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import type { KOTRow } from '@/hooks/use-kitchen';
import { formatElapsed } from '@/utils/date';

interface KOTCardProps {
  kot: KOTRow;
  onAdvance: (kotId: number, currentStatus: KotStatus) => Promise<void>;
}

interface KOTItemRow {
  id: number | string;
  menu_item_name: string;
  quantity: number | string;
  unit_of_measure: string;
  notes: string | null;
  status: string;
  modifier_names: string | null;
}


const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    borderColor: string;
    bgColor: string;
    textColor: string;
    btnColor: string;
    btnLabel: string;
  }
> = {
  [KOT_STATUS.PENDING]: {
    label: 'PENDING',
    borderColor: ThemeColors.warning.border,
    bgColor: ThemeColors.warning.dim,
    textColor: ThemeColors.warning.DEFAULT,
    btnColor: ThemeColors.warning.DEFAULT,
    btnLabel: 'Start',
  },
  [KOT_STATUS.IN_PROGRESS]: {
    label: 'IN PROGRESS',
    borderColor: ThemeColors.info.border,
    bgColor: ThemeColors.info.bg,
    textColor: ThemeColors.info.DEFAULT,
    btnColor: ThemeColors.info.DEFAULT,
    btnLabel: 'Mark Ready',
  },
  [KOT_STATUS.READY]: {
    label: 'READY',
    borderColor: ThemeColors.success.border,
    bgColor: ThemeColors.success.dim,
    textColor: ThemeColors.success.DEFAULT,
    btnColor: ThemeColors.success.DEFAULT,
    btnLabel: 'Served',
  },
};

/**
 * Single KOT card for the Kitchen Display System kanban.
 * Loads its own items reactively via useQuery.
 */
export function KOTCard({ kot, onAdvance }: KOTCardProps) {
  const kotId = toInt(kot.id);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const elapsed = formatElapsed(kot.created_at);
  const elapsedMins = Math.floor(
    (Date.now() - new Date(kot.created_at).getTime()) / 60000
  );
  const isUrgent = elapsedMins >= 12 && kot.status !== KOT_STATUS.READY;

  const isTakeaway = kot.order_type === ORDER_TYPE.TAKEAWAY;
  const roundNum =
    typeof kot.round_number === 'string'
      ? parseInt(kot.round_number, 10)
      : kot.round_number;

  const config = STATUS_CONFIG[kot.status] ?? STATUS_CONFIG[KOT_STATUS.PENDING];

  const { data: items } = useQuery<KOTItemRow>(
    `SELECT ki.id, oi.menu_item_name, oi.quantity, oi.unit_of_measure,
            ki.notes, ki.status,
            GROUP_CONCAT(oim.modifier_name, ', ') AS modifier_names
     FROM kot_items ki
     JOIN order_items oi ON oi.id = ki.order_item_id
     LEFT JOIN order_item_modifiers oim ON oim.order_item_id = ki.order_item_id
     WHERE ki.kot_id = ?
     GROUP BY ki.id`,
    [kotId]
  );

  const handleAdvance = useCallback(async () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    try {
      await onAdvance(kotId, kot.status as KotStatus);
    } finally {
      setIsAdvancing(false);
    }
  }, [isAdvancing, kotId, kot.status, onAdvance]);

  return (
    <View
      className="mb-3 overflow-hidden rounded-xl"
      style={{
        backgroundColor: config.bgColor,
        borderWidth: 1,
        borderColor: config.borderColor,
      }}
    >
      {/* ── Card header ── */}
      <View
        className="flex-row items-center justify-between px-3 py-2"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: ThemeColors.borders.default,
        }}
      >
        <View className="flex-row items-center gap-2">
          {/* Ticket number */}
          <Text className="text-pos-xs font-bold text-pos-text-strong">
            {kot.ticket_number}
          </Text>

          {/* Round badge */}
          <View
            className="rounded px-1.5 py-0.5"
            style={{ backgroundColor: ThemeColors.accent.primary }}
          >
            <Text
              className="font-bold text-white"
              style={{ fontSize: 9 }}
            >
              RND {roundNum}
            </Text>
          </View>

          {isTakeaway && (
            <View
              className="rounded px-1.5 py-0.5"
              style={{ backgroundColor: ThemeColors.warning.badge }}
            >
              <Text
                style={{ fontSize: 9, fontWeight: '700', color: ThemeColors.warning.DEFAULT }}
              >
                TAKEAWAY
              </Text>
            </View>
          )}
        </View>

        {/* Elapsed time */}
        <View
          className="rounded px-1.5 py-0.5"
          style={{
            backgroundColor: isUrgent
              ? ThemeColors.danger.badge
              : ThemeColors.borders.default,
          }}
        >
          <Text
            className="text-[10px] font-semibold"
            style={{ color: isUrgent ? ThemeColors.danger.DEFAULT : ThemeColors.text.muted }}
          >
            {elapsed}
          </Text>
        </View>
      </View>

      {/* ── Table / order info ── */}
      <View className="px-3 pt-2">
        <Text className="text-pos-sm font-bold text-pos-text">
          {isTakeaway ? 'Takeaway' : kot.table_number ? `Table ${kot.table_number}` : '—'}
        </Text>
        <Text className="text-pos-xs text-pos-text-muted">{kot.order_number}</Text>
      </View>

      {/* ── Items ── */}
      <View className="px-3 py-2">
        {(items ?? []).map((item, index) => {
          const qty =
            typeof item.quantity === 'string'
              ? parseFloat(item.quantity)
              : item.quantity;
          const mods = item.modifier_names
            ? item.modifier_names.split(', ').filter(Boolean)
            : [];

          return (
            <View
              key={String(item.id)}
              style={{
                paddingTop: index > 0 ? 6 : 0,
                marginTop: index > 0 ? 6 : 0,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: ThemeColors.borders.default,
              }}
            >
              <View className="flex-row items-start gap-1">
                <Text className="text-pos-sm font-extrabold text-pos-text-strong">
                  {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)}×
                </Text>
                <Text className="flex-1 text-pos-sm font-semibold text-pos-text">
                  {item.menu_item_name}
                </Text>
              </View>
              {mods.map((mod, i) => (
                <Text
                  key={i}
                  className="text-pos-xs text-pos-text-muted"
                  style={{ marginLeft: 18 }}
                >
                  • {mod}
                </Text>
              ))}
              {item.notes ? (
                <Text
                  className="text-pos-xs"
                  style={{ color: ThemeColors.warning.DEFAULT, marginLeft: 18, fontStyle: 'italic' }}
                >
                  ※ {item.notes}
                </Text>
              ) : null}
            </View>
          );
        })}

        {(items ?? []).length === 0 && (
          <Text className="text-pos-xs text-pos-text-faint">Loading items…</Text>
        )}
      </View>

      {/* ── Advance button ── */}
      {kot.status !== KOT_STATUS.SERVED && (
        <Pressable
          onPress={handleAdvance}
          disabled={isAdvancing}
          className="mx-3 mb-3 items-center justify-center rounded-lg py-2"
          style={{
            backgroundColor: isAdvancing ? ThemeColors.surfaces.disabled : config.btnColor,
            opacity: isAdvancing ? 0.6 : 1,
          }}
        >
          <Text className="text-pos-sm font-bold text-white">
            {isAdvancing ? '…' : config.btnLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
