import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

interface QuickEditPopoverProps {
  visible: boolean;
  itemName: string;
  quantity: number;
  notes: string | null;
  onClose: () => void;
  onUpdate: (quantity: number, notes: string) => void;
  onRemove: () => void;
}

export function QuickEditPopover({
  visible,
  itemName,
  quantity,
  notes,
  onClose,
  onUpdate,
  onRemove,
}: QuickEditPopoverProps) {
  const [draftQty, setDraftQty] = useState(quantity);
  const [draftNotes, setDraftNotes] = useState(notes ?? '');

  useEffect(() => {
    if (!visible) return;
    setDraftQty(quantity);
    setDraftNotes(notes ?? '');
  }, [visible, quantity, notes]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50" onPress={onClose}>
        <Pressable
          className="w-[320px] rounded-2xl bg-surface-card p-5"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="text-pos-base font-semibold text-pos-text" numberOfLines={2}>
            {itemName}
          </Text>

          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-pos-sm text-pos-text-muted">Qty</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setDraftQty((prev) => Math.max(0, prev - 1))}
                className="h-8 w-8 items-center justify-center rounded-full bg-surface-raised active:opacity-60"
              >
                <Text className="text-pos-base text-pos-text">−</Text>
              </Pressable>
              <Text className="min-w-[32px] text-center text-pos-base font-bold text-pos-text">
                {draftQty}
              </Text>
              <Pressable
                onPress={() => setDraftQty((prev) => prev + 1)}
                className="h-8 w-8 items-center justify-center rounded-full bg-surface-raised active:opacity-60"
              >
                <Text className="text-pos-base text-pos-text">+</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-4">
            <Text className="mb-2 text-pos-sm text-pos-text-muted">Notes</Text>
            <TextInput
              value={draftNotes}
              onChangeText={setDraftNotes}
              placeholder="Add notes"
              placeholderTextColor="#6B7280"
              multiline
              className="min-h-[70px] rounded-xl bg-surface-raised px-3 py-2 text-pos-sm text-pos-text"
            />
          </View>

          <View className="mt-5 flex-row justify-between">
            <Pressable
              onPress={onRemove}
              className="rounded-xl border border-pos-danger px-4 py-2"
            >
              <Text className="text-pos-sm font-semibold text-pos-danger">Remove</Text>
            </Pressable>
            <Pressable
              onPress={() => onUpdate(draftQty, draftNotes)}
              className="rounded-xl bg-brand px-5 py-2"
            >
              <Text className="text-pos-sm font-semibold text-white">Update</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
