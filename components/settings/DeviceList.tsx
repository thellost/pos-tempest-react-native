import { DEVICE_STATUS } from '@/constants/enums';
import { Brand, ThemeColors } from '@/constants/theme';
import type { Device } from '@/db/models';
import { useDevice } from '@/hooks/use-device';
import {
  deactivateDevice,
  getDevicesByBranch,
  reactivateDevice,
  updateDeviceName,
} from '@/services/device.service';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui';
import { RowDivider } from './primitives';

// ── Internal device row ───────────────────────────────────────────────────────

type DeviceRowProps = {
  item: Device;
  currentDeviceId: string | undefined;
  canManageDevices: boolean;
  editingDeviceId: string | null;
  editingName: string;
  onStartEdit: (id: string, name: string) => void;
  onChangeName: (name: string) => void;
  onSaveEdit: (device: Device) => void;
  onCancelEdit: () => void;
  onDeactivate: (device: Device) => void;
  onReactivate: (device: Device) => void;
};

function DeviceRow({
  item,
  currentDeviceId,
  canManageDevices,
  editingDeviceId,
  editingName,
  onStartEdit,
  onChangeName,
  onSaveEdit,
  onCancelEdit,
  onDeactivate,
  onReactivate,
}: DeviceRowProps) {
  const isCurrentDevice = item.id === currentDeviceId;
  const isActive = item.status !== DEVICE_STATUS.INACTIVE;
  const isEditing = editingDeviceId === item.id;

  return (
    <View
      className={`mb-2 overflow-hidden rounded-xl border ${
        isCurrentDevice
          ? 'border-accent/30 bg-accent-muted'
          : !isActive
          ? 'border-pos-danger/20 bg-pos-danger-muted'
          : 'border-border bg-surface'
      }`}
    >
      {isEditing ? (
        <View className="gap-3 p-3.5">
          <TextInput
            className="rounded-xl border border-border bg-surface p-3 text-pos-base text-pos-text"
            value={editingName}
            onChangeText={onChangeName}
            autoFocus
          />
          <View className="flex-row gap-2">
            <Button
              className="flex-1 items-center justify-center rounded-xl bg-accent p-3"
              onPress={() => onSaveEdit(item)}
            >
              <Text className="text-center text-pos-sm font-semibold text-white">Save</Text>
            </Button>
            <Button
              className="flex-1 items-center justify-center rounded-xl border border-border bg-surface p-3"
              onPress={onCancelEdit}
            >
              <Text className="text-center text-pos-sm text-pos-text">Cancel</Text>
            </Button>
          </View>
        </View>
      ) : (
        <>
          <View className="flex-row items-center gap-3 px-3.5 py-3">
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: isActive ? ThemeColors.success.DEFAULT : ThemeColors.danger.DEFAULT,
              }}
            />
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-pos-xs font-semibold text-pos-text">{item.device_name}</Text>
                {isCurrentDevice && (
                  <View className="rounded-md bg-accent-muted px-2 py-0.5">
                    <Text className="text-pos-xs text-accent">This device</Text>
                  </View>
                )}
                {!isActive && (
                  <View className="rounded-md bg-pos-danger-muted px-2 py-0.5">
                    <Text className="text-pos-xs text-pos-danger">Inactive</Text>
                  </View>
                )}
              </View>
              <Text className="mt-0.5 text-pos-xs text-pos-text-faint">
                {item.id?.slice(0, 8) ?? '--------'}… · {new Date(item.registered_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {canManageDevices && (
            <>
              <RowDivider />
              <View className="flex-row gap-2 px-3.5 py-2.5">
                <Button
                  className="items-center justify-center rounded-lg border border-border bg-surface px-4 py-2"
                  onPress={() => onStartEdit(item.id, item.device_name)}
                >
                  <Text className="text-pos-xs text-pos-text">Rename</Text>
                </Button>
                {isActive ? (
                  <Button
                    className="items-center justify-center rounded-lg border border-pos-danger/20 bg-pos-danger-muted px-4 py-2"
                    onPress={() => onDeactivate(item)}
                  >
                    <Text className="text-pos-xs text-pos-danger">Deactivate</Text>
                  </Button>
                ) : (
                  <Button
                    className="items-center justify-center rounded-lg border border-pos-success/20 bg-pos-success-muted px-4 py-2"
                    onPress={() => onReactivate(item)}
                  >
                    <Text className="text-pos-xs text-pos-success">Reactivate</Text>
                  </Button>
                )}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

// ── Exported list ─────────────────────────────────────────────────────────────

export function DeviceList({ canManageDevices }: { canManageDevices: boolean }) {
  const { registration, deviceInfo, refresh: refreshDevice } = useDevice();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const visibleDevices = devices.filter(
    (d) => d.status !== DEVICE_STATUS.INACTIVE || d.id === deviceInfo?.deviceId
  );

  const load = useCallback(async () => {
    if (!registration?.branch?.id) return;
    try {
      setLoading(true);
      setDevices(await getDevicesByBranch(registration.branch.id));
    } catch (error) {
      console.error('[Settings] Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  }, [registration?.branch?.id]);

  useEffect(() => { load(); }, [load]);

  const handleRename = async (device: Device) => {
    if (!editingName.trim()) {
      Alert.alert('Error', 'Please enter a device name');
      return;
    }
    try {
      await updateDeviceName(device.id, editingName.trim());
      await load();
      setEditingDeviceId(null);
      setEditingName('');
      if (device.id === deviceInfo?.deviceId) await refreshDevice();
    } catch {
      Alert.alert('Error', 'Failed to update device name');
    }
  };

  const handleDeactivate = (device: Device) => {
    Alert.alert(
      'Deactivate Device',
      `Are you sure you want to deactivate "${device.device_name}"? This device will need to re-register to use the POS.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateDevice(device.id);
              await load();
            } catch {
              Alert.alert('Error', 'Failed to deactivate device');
            }
          },
        },
      ]
    );
  };

  const handleReactivate = async (device: Device) => {
    try {
      await reactivateDevice(device.id);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to reactivate device');
    }
  };

  if (loading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (visibleDevices.length === 0) {
    return (
      <View className="rounded-xl border border-border bg-surface px-4 py-5">
        <Text className="text-pos-xs text-pos-text-muted">
          No active devices registered for this branch.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={visibleDevices}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <DeviceRow
          item={item}
          currentDeviceId={deviceInfo?.deviceId}
          canManageDevices={canManageDevices}
          editingDeviceId={editingDeviceId}
          editingName={editingName}
          onStartEdit={(id, name) => { setEditingDeviceId(id); setEditingName(name); }}
          onChangeName={setEditingName}
          onSaveEdit={handleRename}
          onCancelEdit={() => { setEditingDeviceId(null); setEditingName(''); }}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
        />
      )}
    />
  );
}
