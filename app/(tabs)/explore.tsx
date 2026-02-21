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
    ? { label: 'Error', dot: 'bg-pos-danger', chip: 'bg-pos-danger-muted border-pos-danger/30 text-pos-danger' }
    : status.dataFlowStatus.downloading || status.dataFlowStatus.uploading || status.connecting
      ? {
          label: 'Syncing',
          dot: 'bg-pos-warning',
          chip: 'bg-pos-warning-muted border-pos-warning/30 text-pos-warning',
        }
      : status.connected
        ? {
            label: 'Online',
            dot: 'bg-pos-success',
            chip: 'bg-pos-success-muted border-pos-success/30 text-pos-success',
          }
        : {
            label: 'Offline',
            dot: 'bg-slate-400',
            chip: 'bg-surface-card border-border text-pos-text-muted',
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
      <View className="mb-4 rounded-2xl border border-border bg-surface-card p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-pos-2xl font-bold text-pos-text">Operations Overview</Text>
            <Text className="mt-1 text-pos-sm text-pos-text-muted">
              Live branch, order, kitchen, and payment snapshot
            </Text>
          </View>
          <View className={`flex-row items-center gap-2 rounded-full border px-3 py-1 ${connectionBadge.chip}`}>
            <View className={`h-2.5 w-2.5 rounded-full ${connectionBadge.dot}`} />
            <Text className="text-pos-sm font-semibold">{connectionBadge.label}</Text>
          </View>
        </View>

        <Text className="text-pos-sm text-pos-text-muted">
          Connected: {String(status.connected)} · Connecting: {String(status.connecting)} · Downloading:{' '}
          {String(status.dataFlowStatus.downloading)} · Uploading: {String(status.dataFlowStatus.uploading)}
        </Text>
        <Text className="mt-1 text-pos-sm text-pos-text-muted">Status: {status.getMessage()}</Text>
        <Text className="mt-1 text-pos-sm text-pos-text-muted">
          Last Synced: {status.lastSyncedAt ? status.lastSyncedAt.toISOString() : 'Never'}
        </Text>
      </View>

      <View className="mb-4 flex-row flex-wrap gap-3">
        <View className="min-w-[140px] flex-1 rounded-xl border border-border bg-surface-card p-4">
          <Text className="text-pos-sm text-pos-text-muted">Active Branches</Text>
          <Text className="mt-1 text-pos-2xl font-bold text-pos-text">{branches.length}</Text>
        </View>
        <View className="min-w-[140px] flex-1 rounded-xl border border-border bg-surface-card p-4">
          <Text className="text-pos-sm text-pos-text-muted">Recent Orders</Text>
          <Text className="mt-1 text-pos-2xl font-bold text-pos-text">{orders.length}</Text>
        </View>
        <View className="min-w-[140px] flex-1 rounded-xl border border-border bg-surface-card p-4">
          <Text className="text-pos-sm text-pos-text-muted">Kitchen Tickets</Text>
          <Text className="mt-1 text-pos-2xl font-bold text-pos-text">{tickets.length}</Text>
        </View>
      </View>

      {downloadError ? (
        <View className="mb-3 rounded-xl bg-pos-danger-muted p-3">
          <Text className="text-pos-sm text-pos-danger">Download error: {downloadError}</Text>
        </View>
      ) : null}

      {uploadError ? (
        <View className="mb-3 rounded-xl bg-pos-danger-muted p-3">
          <Text className="text-pos-sm text-pos-danger">Upload error: {uploadError}</Text>
        </View>
      ) : null}

      <View className="mb-3 rounded-xl border border-border bg-surface-card p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text">Active Branches</Text>
        {branches.map((b) => (
          <Text key={b.id} className="mb-1 text-pos-sm text-pos-text">
            • {b.name}
          </Text>
        ))}
        {branches.length === 0 ? <Text className="text-pos-sm text-pos-text-muted">No branch rows yet.</Text> : null}
      </View>

      <View className="mb-3 rounded-xl border border-border bg-surface-card p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text">Recent Orders</Text>
        {orders.map((o) => (
          <View key={o.id} className="mb-2 rounded-xl bg-surface-raised p-3">
            <Text className="text-pos-sm font-semibold text-pos-text">
              {o.order_number ?? '-'} · Table {o.table_number ?? '-'}
            </Text>
            <Text className="mt-1 text-pos-sm text-pos-text-muted">
              {o.branch_name ?? '-'} · {o.status ?? '-'} · {o.payment_status ?? '-'}
            </Text>
            <Text className="mt-1 text-pos-sm font-semibold text-accent">
              Rp{Math.round(Number(o.total ?? 0)).toLocaleString('id-ID')}
            </Text>
          </View>
        ))}
        {orders.length === 0 ? <Text className="text-pos-sm text-pos-text-muted">No order rows yet.</Text> : null}
      </View>

      <View className="mb-3 rounded-xl border border-border bg-surface-card p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text">Kitchen Tickets</Text>
        {tickets.map((k) => (
          <View key={k.id} className="mb-2 flex-row items-center justify-between rounded-xl bg-surface-raised p-3">
            <View className="flex-1 pr-3">
              <Text className="text-pos-sm font-semibold text-pos-text">{k.ticket_number ?? '-'}</Text>
              <Text className="text-pos-sm text-pos-text-muted">{k.order_number ?? '-'}</Text>
            </View>
            <Text className="rounded-full bg-accent-muted px-3 py-1 text-pos-xs font-semibold uppercase tracking-wide text-accent">
              {k.status ?? '-'}
            </Text>
          </View>
        ))}
        {tickets.length === 0 ? (
          <Text className="text-pos-sm text-pos-text-muted">No kitchen ticket rows yet.</Text>
        ) : null}
      </View>

      <View className="mb-3 rounded-xl border border-border bg-surface-card p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text">Payment Summary</Text>
        {paymentSummary.map((p) => (
          <View
            key={`${p.payment_method}`}
            className="mb-2 flex-row items-center justify-between rounded-xl bg-surface-raised p-3">
            <Text className="text-pos-sm text-pos-text">{p.payment_method}</Text>
            <Text className="text-pos-sm font-semibold text-pos-text">
              Rp{Math.round(Number(p.total ?? 0)).toLocaleString('id-ID')}
            </Text>
          </View>
        ))}
        {paymentSummary.length === 0 ? <Text className="text-pos-sm text-pos-text-muted">No payment rows yet.</Text> : null}
      </View>

      <View className="rounded-xl border border-border bg-surface-card p-4">
        <Text className="mb-2 text-pos-base font-semibold text-pos-text">Debug Snapshot</Text>
        <Text className="text-pos-xs text-pos-text-faint">{statusSignature}</Text>
      </View>
    </ScrollView>
  );
}
