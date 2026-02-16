import { usePowerSyncRuntime } from '@/components/powersync-provider';
import { useQuery, useStatus } from '@powersync/react';
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
  const runtime = usePowerSyncRuntime();

  if (!runtime.ready) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>PowerSync POS Demo</Text>
        <Text style={styles.subtitle}>Initializing…</Text>
      </ScrollView>
    );
  }

  if (!runtime.available) {
    return <FallbackDemo reason={runtime.reason} />;
  }

  return <PowerSyncLiveDemo />;
}

function PowerSyncLiveDemo() {
  const status = useStatus();

  const { data: branches } = useQuery<BranchRow>(
    'SELECT id, name FROM branches WHERE is_active = 1 ORDER BY id'
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
        Connected: {String(status.connected)} · Downloading: {String(status.dataFlowStatus.downloading)} ·
        Uploading: {String(status.dataFlowStatus.uploading)}
      </Text>

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

function FallbackDemo({ reason }: { reason: string | null }) {
  const branches = [
    'Warung Terapung - Kemang',
    'Warung Terapung - Senopati',
    'Warung Terapung - BSD',
  ];

  const recentOrders = [
    'ORD-20260212-005 · BSD · Table A4 · pending · Rp271.000 · unpaid',
    'ORD-20260212-004 · Senopati · Table A2 · preparing · Rp250.000 · unpaid',
    'ORD-20260212-001 · Kemang · Table A3 · completed · Rp200.000 · paid',
  ];

  const tickets = [
    'KOT-20260212-005 · ORD-20260212-005 · pending',
    'KOT-20260212-004 · ORD-20260212-004 · in_progress',
  ];

  const paymentSummary = ['qris: Rp400.000', 'cash: Rp271.000'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PowerSync POS Demo</Text>
      <Text style={styles.subtitle}>Fallback preview (using PopulatedSQL sample rows)</Text>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Live sync is disabled in this runtime</Text>
        <Text style={styles.noticeText}>{reason ?? 'Please run a development build.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Branches</Text>
        {branches.map((b) => (
          <Text key={b} style={styles.rowText}>
            • {b}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Orders</Text>
        {recentOrders.map((o) => (
          <Text key={o} style={styles.rowText}>
            {o}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kitchen Tickets</Text>
        {tickets.map((k) => (
          <Text key={k} style={styles.rowText}>
            {k}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Summary</Text>
        {paymentSummary.map((p) => (
          <Text key={p} style={styles.rowText}>
            {p}
          </Text>
        ))}
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
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  noticeCard: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    padding: 12,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  noticeText: {
    color: '#78350F',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowText: {
    fontSize: 14,
  },
  empty: {
    fontSize: 13,
    opacity: 0.65,
  },
});
