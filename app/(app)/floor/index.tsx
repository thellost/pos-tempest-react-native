import { runPinMigration } from '@/lib/migrate-pins';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

/**
 * Floor & Table Management screen.
 * To be implemented in Step 5.
 */
export default function FloorScreen() {
  const [migrating, setMigrating] = useState(false);

  const handleMigration = async () => {
    try {
      setMigrating(true);
      await runPinMigration();
      Alert.alert('Success', 'PIN migration completed successfully!');
    } catch (error) {
      Alert.alert('Error', 'PIN migration failed. Check console for details.');
      console.error('Migration error:', error);
    } finally {
      setMigrating(false);
    }
  };
  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16 }}>
      <View className="mb-6">
        <Text className="mb-2 text-pos-3xl font-bold text-pos-text-strong">Floor Plan</Text>
        <Text className="text-pos-base text-pos-muted">Table management (Step 5)</Text>
      </View>

      <View className="mb-4 grid gap-3">
        <Pressable
          className="rounded-xl border border-white/10 bg-surface-soft p-4"
          onPress={() => router.push({ pathname: '/(app)/order/[tableId]', params: { tableId: 'table-a3' } })}>
          <Text className="text-pos-lg font-semibold text-pos-text-strong">Table A3</Text>
          <Text className="text-pos-sm text-pos-muted">Tap to create order</Text>
        </Pressable>

        <Pressable
          className="rounded-xl border border-white/10 bg-surface-soft p-4"
          onPress={() => router.push({ pathname: '/(app)/kitchen' } as any)}>
          <Text className="text-pos-lg font-semibold text-pos-text-strong">Kitchen Display</Text>
          <Text className="text-pos-sm text-pos-muted">View active tickets</Text>
        </Pressable>

        <Pressable
          className="rounded-xl border border-white/10 bg-surface-soft p-4"
          onPress={() => router.push({ pathname: '/(app)/shifts' } as any)}>
          <Text className="text-pos-lg font-semibold text-pos-text-strong">Shift Management</Text>
          <Text className="text-pos-sm text-pos-muted">Open/close shift</Text>
        </Pressable>

        <Pressable
          className="rounded-xl border border-white/10 bg-surface-soft p-4"
          onPress={() => router.push({ pathname: '/(app)/settings' } as any)}>
          <Text className="text-pos-lg font-semibold text-pos-text-strong">Settings</Text>
          <Text className="text-pos-sm text-pos-muted">Branch & printer config</Text>
        </Pressable>

        <Pressable
          className="rounded-xl border border-white/10 bg-surface-soft p-4"
          onPress={() => router.push('/(tabs)/explore')}>
          <Text className="text-pos-lg font-semibold text-pos-text-strong">Dashboard</Text>
          <Text className="text-pos-sm text-pos-muted">PowerSync status</Text>
        </Pressable>

        {/* TEMPORARY: PIN Migration Button - Remove after migration */}
        <Pressable
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4"
          onPress={handleMigration}
          disabled={migrating}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-pos-lg font-semibold text-yellow-400">🔐 Migrate PINs</Text>
              <Text className="text-pos-sm text-yellow-300/70">
                {migrating ? 'Running...' : 'One-time setup (remove after)'}
              </Text>
            </View>
            {migrating && <ActivityIndicator color="#facc15" />}
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}
