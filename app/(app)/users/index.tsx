import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import { Search, User, UserCog, Users, X } from 'lucide-react-native';

import { PERMISSION } from '@/constants/permissions';
import { ROLE_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui';
import { useUsers } from '@/hooks/use-users';
import type { UserWithRole } from '@/hooks/use-users';
import { RoleBadge } from '@/components/users/RoleBadge';
import { AddUserModal } from '@/components/users/AddUserModal';
import { UserDetail } from '@/components/users/UserDetail';

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const { users, isLoading, isUpdating, setActive } = useUsers();
  const { can } = usePermissions();

  const canManageManagers = can(PERMISSION.MANAGE_MANAGERS);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = searchQuery
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.role_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  const handleToggleActive = async (userId: number, active: boolean) => {
    try {
      await setActive(userId, active);
      if (selectedUser?.id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, is_active: active ? 1 : 0 } : null));
      }
    } catch {
      Alert.alert('Error', 'Failed to update user status.');
    }
  };

  /** The caller can only deactivate users whose role they are allowed to manage. */
  const canDeactivateUser = (user: UserWithRole): boolean => {
    if (user.role_name === ROLE_TYPE.MANAGER || user.role_name === ROLE_TYPE.ADMIN) {
      return canManageManagers;
    }
    return can(PERMISSION.MANAGE_USERS);
  };

  return (
    <View className="flex-1 flex-row bg-surface">
      {/* Left panel — user list */}
      <View className="w-[38%] border-r border-border bg-surface-card">
        <View className="border-b border-border px-5 py-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-pos-2xl font-bold text-pos-text">Staff</Text>

            {/* Only managers and admins can add users */}
            <PermissionGate permission={PERMISSION.MANAGE_USERS}>
              <Button
                onPress={() => setShowAddModal(true)}
                className="flex-row items-center rounded-xl bg-brand px-4 py-2.5"
              >
                <Text className="text-pos-sm font-bold text-white">+ Add User</Text>
              </Button>
            </PermissionGate>
          </View>

          <View className="mt-4 flex-row items-center rounded-xl border border-border bg-surface px-4 py-2.5">
            <Search size={16} color={ThemeColors.text.muted} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search name, email, or role…"
              placeholderTextColor={ThemeColors.text.faint}
              className="flex-1 text-pos-base text-pos-text"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={16} color={ThemeColors.text.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={ThemeColors.accent.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            <User size={32} color={ThemeColors.text.muted} />
            <Text className="mt-3 text-center text-pos-base text-pos-text-muted">
              {searchQuery ? `No staff matching "${searchQuery}"` : 'No staff members found.'}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1">
            {filtered.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              const isActive = Boolean(user.is_active);
              return (
                <Pressable
                  key={user.id}
                  onPress={() => setSelectedUser(user)}
                  className={`border-b border-border px-5 py-4 active:bg-surface-raised ${
                    isSelected ? 'bg-brand/10' : ''
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`h-11 w-11 items-center justify-center rounded-full ${
                        isActive ? 'bg-brand/20' : 'bg-surface-raised'
                      }`}
                    >
                      <Text
                        className={`text-pos-base font-bold ${
                          isActive ? 'text-brand' : 'text-pos-text-faint'
                        }`}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-pos-base font-semibold ${
                          isSelected ? 'text-brand' : isActive ? 'text-pos-text' : 'text-pos-text-faint'
                        }`}
                        numberOfLines={1}
                      >
                        {user.name}
                      </Text>
                      <Text className="text-pos-xs text-pos-text-muted" numberOfLines={1}>
                        {user.email ?? 'No email'}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <RoleBadge role={user.role_name} />
                      {!isActive && (
                        <Text className="text-pos-xs text-pos-text-faint">Inactive</Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Right panel — detail or empty state */}
      <View className="flex-1">
        {selectedUser ? (
          <UserDetail
            user={selectedUser}
            canEdit={can(PERMISSION.MANAGE_USERS)}
            canDeactivate={canDeactivateUser(selectedUser)}
            isUpdating={isUpdating}
            onClose={() => setSelectedUser(null)}
            onToggleActive={handleToggleActive}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-surface-card">
              <Users size={40} color={ThemeColors.text.muted} />
            </View>
            <Text className="text-pos-xl font-semibold text-pos-text">Staff Management</Text>
            <Text className="mt-2 text-center text-pos-base text-pos-text-muted">
              Select a staff member to view their details{'\n'}and manage account access.
            </Text>
            <PermissionGate permission={PERMISSION.MANAGE_USERS}>
              <Button
                onPress={() => setShowAddModal(true)}
                className="mt-6 flex-row items-center rounded-2xl bg-brand px-6 py-3.5"
              >
                <UserCog size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text className="text-pos-base font-bold text-white">Add Staff Member</Text>
              </Button>
            </PermissionGate>
          </View>
        )}
      </View>

      {/* Add User modal — role options filtered by MANAGE_MANAGERS permission */}
      <AddUserModal
        visible={showAddModal}
        canManageManagers={canManageManagers}
        onClose={() => setShowAddModal(false)}
      />
    </View>
  );
}
