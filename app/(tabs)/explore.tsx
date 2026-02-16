import { useQuery, useStatus } from '@powersync/react';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
  }, [statusSignature, statusSnapshot]);

  const { data: branches } = useQuery<BranchRow>(
    "SELECT id, name FROM branches WHERE is_active = 'true' ORDER BY id"
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PowerSync POS Demo</Text>
      <Text style={styles.subtitle}>
        Connected: {String(status.connected)} · Connecting: {String(status.connecting)} · Downloading:{' '}
        {String(status.dataFlowStatus.downloading)} · Uploading: {String(status.dataFlowStatus.uploading)}
      </Text>
      <Text style={styles.subtitle}>Status: {status.getMessage()}</Text>
      <Text style={styles.subtitle}>hasSynced: {String(status.hasSynced)}</Text>
      <Text style={styles.subtitle}>
        lastSyncedAt: {status.lastSyncedAt ? status.lastSyncedAt.toISOString() : 'null'}
      </Text>
      {downloadError ? <Text style={styles.error}>Download error: {downloadError}</Text> : null}
      {uploadError ? <Text style={styles.error}>Upload error: {uploadError}</Text> : null}

      <View style={styles.debugCard}>
        <Text style={styles.cardTitle}>Debug Snapshot</Text>
        <Text style={styles.debugText}>{statusSignature}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Branches</Text>
        {branches.map((b) => (
          <Text key={b.id} style={styles.rowText}>
            • {b.name}
          </Text>
        ))}
        {branches.length === 0 ? <Text style={styles.empty}>No branch rows yet.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Orders</Text>
        {orders.map((o) => (
          <Text key={o.id} style={styles.rowText}>
            {o.order_number} · {o.branch_name} · Table {o.table_number ?? '-'} · {o.status} · Rp
            {Math.round(Number(o.total ?? 0)).toLocaleString('id-ID')} · {o.payment_status}
          </Text>
        ))}
        {orders.length === 0 ? <Text style={styles.empty}>No order rows yet.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kitchen Tickets</Text>
        {tickets.map((k) => (
          <Text key={k.id} style={styles.rowText}>
            {k.ticket_number} · {k.order_number} · {k.status}
          </Text>
        ))}
        {tickets.length === 0 ? <Text style={styles.empty}>No kitchen ticket rows yet.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Summary</Text>
        {paymentSummary.map((p) => (
          <Text key={`${p.payment_method}`} style={styles.rowText}>
            {p.payment_method}: Rp{Math.round(Number(p.total ?? 0)).toLocaleString('id-ID')}
          </Text>
        ))}
        {paymentSummary.length === 0 ? <Text style={styles.empty}>No payment rows yet.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    opacity: 0.8,
  },
  error: {
    color: '#B91C1C',
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  debugCard: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  debugText: {
    fontSize: 12,
    opacity: 0.85,
  },
  rowText: {
    fontSize: 14,
  },
  empty: {
    fontSize: 13,
    opacity: 0.65,
  },
});
