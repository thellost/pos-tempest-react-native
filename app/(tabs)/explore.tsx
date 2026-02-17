import { useQuery, useStatus } from '@powersync/react';
import { useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

type BranchRow = {
  id: string;
  name: string | null;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  status: string | null;
  total: number | null;
  payment_status: string | null;
  branch_name: string | null;
  table_number: string | null;
};

type TicketRow = {
  id: string;
  ticket_number: string | null;
  status: string | null;
  order_number: string | null;
};

type PaymentSummary = {
  payment_method: string | null;
  total: number | null;
};

export default function ExploreScreen() {
  const status = useStatus();
  const downloadError = status.dataFlowStatus.downloadError?.message;
  const uploadError = status.dataFlowStatus.uploadError?.message;
  const hasSyncError = Boolean(downloadError || uploadError);

  const connectionBadge = hasSyncError
    ? { label: 'Error', dot: 'bg-red-500', chip: 'bg-red-500/15 border-red-500/30 text-red-300' }
    : status.dataFlowStatus.downloading || status.dataFlowStatus.uploading || status.connecting
      ? {
          label: 'Syncing',
          dot: 'bg-amber-400',
          chip: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        }
      : status.connected
        ? {
            label: 'Online',
            dot: 'bg-emerald-400',
            chip: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          }
        : {
            label: 'Offline',
            dot: 'bg-slate-400',
            chip: 'bg-slate-500/15 border-slate-500/30 text-slate-300',
          };

  const statusSnapshot = useMemo(
    () => ({
      connected: status.connected,
      connecting: status.connecting,
      hasSynced: status.hasSynced,
      lastSyncedAt: status.lastSyncedAt ? status.lastSyncedAt.toISOString() : null,
      downloadProgress: status.downloadProgress,
      dataFlowStatus: {
        downloading: status.dataFlowStatus.downloading,
        uploading: status.dataFlowStatus.uploading,
        downloadError: status.dataFlowStatus.downloadError?.message,
        uploadError: status.dataFlowStatus.uploadError?.message,
      },
      statusMessage: status.getMessage(),
      rawStatus: status.toJSON(),
    }),
    [status]
  );

  const statusSignature = JSON.stringify(statusSnapshot);

  useEffect(() => {
    console.log('[PowerSync][status][ExploreScreen]', statusSnapshot);
  }, [statusSnapshot, statusSignature]);

  const { data: branches } = useQuery<BranchRow>(
    "SELECT id, name FROM branches WHERE is_active = true ORDER BY id"
  );

  const { data: orders } = useQuery<OrderRow>(
    `SELECT
      o.id,
      o.order_number,
      o.status,
      o.total,
      o.payment_status,
      b.name as branch_name,
      t.table_number as table_number
    FROM orders o
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN tables t ON t.id = o.table_id
    ORDER BY o.created_at DESC
    LIMIT 8`
  );

  const { data: tickets } = useQuery<TicketRow>(
    `SELECT
      k.id,
      k.ticket_number,
      k.status,
      o.order_number
    FROM kitchen_order_tickets k
    LEFT JOIN orders o ON o.id = k.order_id
    ORDER BY k.created_at DESC
    LIMIT 6`
  );

  const { data: paymentSummary } = useQuery<PaymentSummary>(
    'SELECT payment_method, SUM(amount) as total FROM payments GROUP BY payment_method ORDER BY total DESC'
  );

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View className="mb-4 rounded-2xl border border-white/10 bg-surface-soft p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-pos-2xl font-bold text-pos-text-strong">Operations Overview</Text>
            <Text className="mt-1 text-pos-sm text-pos-muted">
              Live branch, order, kitchen, and payment snapshot
            </Text>
          </View>
          <View className={`flex-row items-center gap-2 rounded-full border px-3 py-1 ${connectionBadge.chip}`}>
            <View className={`h-2.5 w-2.5 rounded-full ${connectionBadge.dot}`} />
            <Text className="text-pos-sm font-semibold">{connectionBadge.label}</Text>
          </View>
        </View>

        <Text className="text-pos-sm text-pos-muted">
          Connected: {String(status.connected)} · Connecting: {String(status.connecting)} · Downloading:{' '}
          {String(status.dataFlowStatus.downloading)} · Uploading: {String(status.dataFlowStatus.uploading)}
        </Text>
        <Text className="mt-1 text-pos-sm text-pos-muted">Status: {status.getMessage()}</Text>
        <Text className="mt-1 text-pos-sm text-pos-muted">
          Last Synced: {status.lastSyncedAt ? status.lastSyncedAt.toISOString() : 'Never'}
        </Text>
      </View>

      <View className="mb-4 flex-row flex-wrap gap-3">
        <View className="min-w-[140px] flex-1 rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <Text className="text-pos-sm text-pos-muted">Active Branches</Text>
          <Text className="mt-1 text-pos-2xl font-bold text-pos-text-strong">{branches.length}</Text>
        </View>
        <View className="min-w-[140px] flex-1 rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <Text className="text-pos-sm text-pos-muted">Recent Orders</Text>
          <Text className="mt-1 text-pos-2xl font-bold text-pos-text-strong">{orders.length}</Text>
        </View>
        <View className="min-w-[140px] flex-1 rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <Text className="text-pos-sm text-pos-muted">Kitchen Tickets</Text>
          <Text className="mt-1 text-pos-2xl font-bold text-pos-text-strong">{tickets.length}</Text>
        </View>
      </View>

      {downloadError ? (
        <View className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <Text className="text-pos-sm text-red-300">Download error: {downloadError}</Text>
        </View>
      ) : null}

      {uploadError ? (
        <View className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <Text className="text-pos-sm text-red-300">Upload error: {uploadError}</Text>
        </View>
      ) : null}

      <View className="mb-3 rounded-xl border border-white/10 bg-surface-soft p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text-strong">Active Branches</Text>
        {branches.map((b) => (
          <Text key={b.id} className="mb-1 text-pos-sm text-pos-text">
            • {b.name}
          </Text>
        ))}
        {branches.length === 0 ? <Text className="text-pos-sm text-pos-muted">No branch rows yet.</Text> : null}
      </View>

      <View className="mb-3 rounded-xl border border-white/10 bg-surface-soft p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text-strong">Recent Orders</Text>
        {orders.map((o) => (
          <View key={o.id} className="mb-2 rounded-lg bg-white/5 p-3">
            <Text className="text-pos-sm font-semibold text-pos-text-strong">
              {o.order_number ?? '-'} · Table {o.table_number ?? '-'}
            </Text>
            <Text className="mt-1 text-pos-sm text-pos-muted">
              {o.branch_name ?? '-'} · {o.status ?? '-'} · {o.payment_status ?? '-'}
            </Text>
            <Text className="mt-1 text-pos-sm font-semibold text-brand">
              Rp{Math.round(Number(o.total ?? 0)).toLocaleString('id-ID')}
            </Text>
          </View>
        ))}
        {orders.length === 0 ? <Text className="text-pos-sm text-pos-muted">No order rows yet.</Text> : null}
      </View>

      <View className="mb-3 rounded-xl border border-white/10 bg-surface-soft p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text-strong">Kitchen Tickets</Text>
        {tickets.map((k) => (
          <View key={k.id} className="mb-2 flex-row items-center justify-between rounded-lg bg-white/5 p-3">
            <View className="flex-1 pr-3">
              <Text className="text-pos-sm font-semibold text-pos-text-strong">{k.ticket_number ?? '-'}</Text>
              <Text className="text-pos-sm text-pos-muted">{k.order_number ?? '-'}</Text>
            </View>
            <Text className="rounded-full bg-brand/20 px-2 py-1 text-pos-xs font-semibold uppercase tracking-wide text-brand">
              {k.status ?? '-'}
            </Text>
          </View>
        ))}
        {tickets.length === 0 ? (
          <Text className="text-pos-sm text-pos-muted">No kitchen ticket rows yet.</Text>
        ) : null}
      </View>

      <View className="mb-3 rounded-xl border border-white/10 bg-surface-soft p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text-strong">Payment Summary</Text>
        {paymentSummary.map((p) => (
          <View
            key={`${p.payment_method}`}
            className="mb-2 flex-row items-center justify-between rounded-lg bg-white/5 p-3">
            <Text className="text-pos-sm text-pos-text">{p.payment_method}</Text>
            <Text className="text-pos-sm font-semibold text-pos-text-strong">
              Rp{Math.round(Number(p.total ?? 0)).toLocaleString('id-ID')}
            </Text>
          </View>
        ))}
        {paymentSummary.length === 0 ? <Text className="text-pos-sm text-pos-muted">No payment rows yet.</Text> : null}
      </View>

      <View className="rounded-xl border border-white/10 bg-black/20 p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text-strong">Debug Snapshot</Text>
        <Text className="text-pos-xs text-pos-muted">{statusSignature}</Text>
      </View>
    </ScrollView>
  );
}
