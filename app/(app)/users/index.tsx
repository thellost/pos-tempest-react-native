import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';

import { Mail, Phone, Search, Shield, User, UserCog, Users, X } from 'lucide-react-native';

import { PERMISSION } from '@/constants/permissions';
import { ROLE_TYPE } from '@/constants/enums';
import type { RoleType } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { usePermissions } from '@/hooks/use-permissions';
import { Button, IconButton } from '@/components/ui';
import { useUsers } from '@/hooks/use-users';
import type { UserWithRole } from '@/hooks/use-users';

// ── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  [ROLE_TYPE.WAITER]:   'Waiter',
  [ROLE_TYPE.CASHIER]:  'Cashier',
  [ROLE_TYPE.MANAGER]:  'Manager',
  [ROLE_TYPE.ADMIN]:    'Admin',
};

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  [ROLE_TYPE.WAITER]:  { bg: ThemeColors.accent.primaryLight,  text: ThemeColors.accent.primary },
  [ROLE_TYPE.CASHIER]: { bg: ThemeColors.success.light,         text: ThemeColors.success.DEFAULT },
  [ROLE_TYPE.MANAGER]: { bg: ThemeColors.warning.muted,         text: ThemeColors.warning.DEFAULT },
  [ROLE_TYPE.ADMIN]:   { bg: ThemeColors.danger.muted,          text: ThemeColors.danger.DEFAULT },
};

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS[ROLE_TYPE.WAITER];
  return (
    <View style={{ backgroundColor: style.bg }} className="rounded-md px-2 py-0.5">
      <Text style={{ color: style.text }} className="text-pos-xs font-semibold capitalize">
        {ROLE_LABELS[role] ?? role}
      </Text>
    </View>
  );
}

// ── Add User modal ─────────────────────────────────────────────────────────────

const PLACEHOLDER = ThemeColors.text.faint;
const ALL_ROLES: RoleType[] = [ROLE_TYPE.WAITER, ROLE_TYPE.CASHIER, ROLE_TYPE.MANAGER, ROLE_TYPE.ADMIN];
const RESTRICTED_ROLES: RoleType[] = [ROLE_TYPE.WAITER, ROLE_TYPE.CASHIER];

const EMPTY_FORM = { name: '', email: '', phone: '', role: ROLE_TYPE.WAITER as RoleType };

interface AddUserModalProps {
  visible: boolean;
  canManageManagers: boolean;
  onClose: () => void;
}

function AddUserModal({ visible, canManageManagers, onClose }: AddUserModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);

  const availableRoles = canManageManagers ? ALL_ROLES : RESTRICTED_ROLES;

  const reset = () => setForm(EMPTY_FORM);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Full name is required.');
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('Validation', 'Email address is required.');
      return;
    }
    // User creation requires a Supabase Admin API call (e.g. an Edge Function
    // that calls supabase.auth.admin.inviteUserByEmail). This UI is fully wired
    // for the permission-gated form; connect it to your invite endpoint here.
    Alert.alert(
      'Not yet implemented',
      'Sending invitations requires a server-side Edge Function. Connect this form to your invite endpoint.',
      [{ text: 'OK' }]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-4">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full max-w-lg"
        >
          <View className="rounded-3xl bg-surface-card p-6">
            <Text className="mb-5 text-pos-xl font-bold text-pos-text">Add Staff Member</Text>

            {/* Name */}
            <View className="mb-4">
              <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Full Name *</Text>
              <TextInput
                value={form.name}
                onChangeText={(name) => setForm((p) => ({ ...p, name }))}
                placeholder="e.g. Budi Santoso"
                placeholderTextColor={PLACEHOLDER}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
              />
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Email *</Text>
              <View className="flex-row items-center rounded-xl border border-brand bg-surface px-4 py-3">
                <Mail size={16} color={ThemeColors.text.muted} style={{ marginRight: 8 }} />
                <TextInput
                  value={form.email}
                  onChangeText={(email) => setForm((p) => ({ ...p, email }))}
                  placeholder="staff@restaurant.com"
                  placeholderTextColor={PLACEHOLDER}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="flex-1 text-pos-base text-pos-text"
                />
              </View>
            </View>

            {/* Phone */}
            <View className="mb-4">
              <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                Phone <Text className="text-pos-text-muted">(optional)</Text>
              </Text>
              <View className="flex-row items-center rounded-xl border border-border bg-surface px-4 py-3">
                <Phone size={16} color={ThemeColors.text.muted} style={{ marginRight: 8 }} />
                <TextInput
                  value={form.phone}
                  onChangeText={(phone) => setForm((p) => ({ ...p, phone }))}
                  placeholder="081234567890"
                  placeholderTextColor={PLACEHOLDER}
                  keyboardType="phone-pad"
                  className="flex-1 text-pos-base text-pos-text"
                />
              </View>
            </View>

            {/* Role selector — filtered by caller's permissions */}
            <View className="mb-6">
              <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Role *</Text>
              <View className="flex-row flex-wrap gap-2">
                {availableRoles.map((role) => {
                  const active = form.role === role;
                  const style = ROLE_BADGE_COLORS[role];
                  return (
                    <Pressable
                      key={role}
                      onPress={() => setForm((p) => ({ ...p, role }))}
                      style={{
                        backgroundColor: active ? style.bg : ThemeColors.surfaces.raised,
                        borderWidth: 1,
                        borderColor: active ? style.text : ThemeColors.borders.default,
                      }}
                      className="rounded-xl px-4 py-2.5"
                    >
                      <Text
                        style={{ color: active ? style.text : ThemeColors.text.muted }}
                        className="text-pos-sm font-semibold"
                      >
                        {ROLE_LABELS[role]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {!canManageManagers && (
                <View className="mt-2 flex-row items-center gap-1.5">
                  <Shield size={12} color={ThemeColors.text.faint} />
                  <Text className="text-pos-xs text-pos-text-faint">
                    Manager and Admin roles require admin privileges.
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-3">
              <Button
                onPress={handleClose}
                className="flex-1 items-center rounded-2xl border border-border py-3.5"
              >
                <Text className="text-pos-base font-semibold text-pos-text-muted">Cancel</Text>
              </Button>
              <Button
                onPress={handleSubmit}
                className="flex-[2] items-center rounded-2xl bg-brand py-3.5"
              >
                <Text className="text-pos-base font-bold text-white">Send Invite</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── User detail panel ─────────────────────────────────────────────────────────

interface UserDetailProps {
  user: UserWithRole;
  canEdit: boolean;
  canDeactivate: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onToggleActive: (userId: number, active: boolean) => void;
}

function UserDetail({ user, canEdit, canDeactivate, isUpdating, onClose, onToggleActive }: UserDetailProps) {
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
