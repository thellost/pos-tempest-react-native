import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Mail, Phone, Shield } from 'lucide-react-native';

import { ROLE_TYPE } from '@/constants/enums';
import type { RoleType } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { Button } from '@/components/ui';
import { ROLE_BADGE_COLORS, ROLE_LABELS } from '@/components/users/RoleBadge';

const PLACEHOLDER = ThemeColors.text.faint;
const ALL_ROLES: RoleType[] = [ROLE_TYPE.WAITER, ROLE_TYPE.CASHIER, ROLE_TYPE.MANAGER, ROLE_TYPE.ADMIN];
const RESTRICTED_ROLES: RoleType[] = [ROLE_TYPE.WAITER, ROLE_TYPE.CASHIER];

const EMPTY_FORM = { name: '', email: '', phone: '', role: ROLE_TYPE.WAITER as RoleType };

export interface AddUserModalProps {
  visible: boolean;
  canManageManagers: boolean;
  onClose: () => void;
}

export function AddUserModal({ visible, canManageManagers, onClose }: AddUserModalProps) {
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
