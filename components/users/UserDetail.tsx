import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Mail, Phone, X } from 'lucide-react-native';

import { ROLE_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { Button, IconButton } from '@/components/ui';
import type { UserWithRole } from '@/hooks/use-users';
import { RoleBadge, ROLE_LABELS } from '@/components/users/RoleBadge';

export interface UserDetailProps {
  user: UserWithRole;
  canEdit: boolean;
  canDeactivate: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onToggleActive: (userId: number, active: boolean) => void;
}

export function UserDetail({ user, canEdit, canDeactivate, isUpdating, onClose, onToggleActive }: UserDetailProps) {
  const isActive = Boolean(user.is_active);

  const handleToggle = () => {
    const action = isActive ? 'Deactivate' : 'Reactivate';
    Alert.alert(
      `${action} "${user.name}"?`,
      isActive
        ? 'This user will be unable to log in until reactivated.'
        : 'This user will be able to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: isActive ? 'destructive' : 'default',
          onPress: () => onToggleActive(user.id, !isActive),
        },
      ]
    );
  };

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="border-b border-border px-6 py-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-pos-2xl font-bold text-pos-text" numberOfLines={1}>
              {user.name}
            </Text>
            {user.email ? (
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Mail size={12} color={ThemeColors.text.muted} />
                <Text className="text-pos-sm text-pos-text-muted">{user.email}</Text>
              </View>
            ) : null}
            {user.phone ? (
              <View className="flex-row items-center gap-1.5">
                <Phone size={12} color={ThemeColors.text.muted} />
                <Text className="text-pos-sm text-pos-text-muted">{user.phone}</Text>
              </View>
            ) : null}
          </View>
          <IconButton size="lg" onPress={onClose} className="ml-4 rounded-full bg-surface-raised">
            <X size={18} color={ThemeColors.text.muted} />
          </IconButton>
        </View>

        <View className="mt-4 flex-row items-center gap-3">
          <RoleBadge role={user.role_name} />
          <View
            className={`rounded-md px-2 py-0.5 ${isActive ? 'bg-pos-success-muted' : 'bg-surface-raised'}`}
          >
            <Text
              className={`text-pos-xs font-semibold ${isActive ? 'text-pos-success' : 'text-pos-text-faint'}`}
            >
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <ScrollView className="flex-1 px-6 py-4">
        <View className="mb-2 rounded-xl border border-border bg-surface p-4">
          <Text className="mb-3 text-pos-sm font-semibold text-pos-text">Account Details</Text>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-pos-xs text-pos-text-muted">User ID</Text>
              <Text className="text-pos-xs font-medium text-pos-text">#{user.id}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-xs text-pos-text-muted">Role</Text>
              <Text className="text-pos-xs font-medium capitalize text-pos-text">
                {ROLE_LABELS[user.role_name] ?? user.role_name}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-xs text-pos-text-muted">Last login</Text>
              <Text className="text-pos-xs font-medium text-pos-text">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Never'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-pos-xs text-pos-text-muted">Created</Text>
              <Text className="text-pos-xs font-medium text-pos-text">
                {new Date(user.created_at).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Deactivate / reactivate — only for permitted roles */}
        {canDeactivate ? (
          <Button
            onPress={handleToggle}
            disabled={isUpdating}
            className={`mt-2 items-center justify-center rounded-xl py-3.5 ${
              isActive
                ? 'border border-pos-danger/30 bg-pos-danger-muted'
                : 'border border-pos-success/30 bg-pos-success-muted'
            }`}
          >
            {isUpdating ? (
              <ActivityIndicator color={isActive ? ThemeColors.danger.DEFAULT : ThemeColors.success.DEFAULT} />
            ) : (
              <Text
                className={`text-pos-sm font-semibold ${
                  isActive ? 'text-pos-danger' : 'text-pos-success'
                }`}
              >
                {isActive ? 'Deactivate Account' : 'Reactivate Account'}
              </Text>
            )}
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}
