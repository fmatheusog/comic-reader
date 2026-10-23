import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Book } from '@/db/books';
import { t } from '@/i18n/pt';
import { useAppTheme } from '@/theme';

type Props = {
  book: Book | null;
  onClose: () => void;
  onRename: (title: string) => void;
  onToggleRead: () => void;
  onDelete: () => void;
};

export function BookActionsModal({ book, onClose, onRename, onToggleRead, onDelete }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(book?.title ?? '');


  const action = (label: string, onPress: () => void, danger = false) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" style={styles.action}>
      <Text style={[styles.actionText, { color: danger ? '#D93025' : theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!book} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.close} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, paddingBottom: insets.bottom + 12, borderColor: theme.border },
        ]}>
        <Text style={[styles.heading, { color: theme.text }]} numberOfLines={2}>
          {book?.title}
        </Text>
        {renaming ? (
          <>
            <TextInput
              value={title}
              onChangeText={setTitle}
              autoFocus
              accessibilityLabel={t.renameTitle}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <View style={styles.row}>
              {action(t.cancel, () => setRenaming(false))}
              {action(t.save, () => title.trim() && onRename(title))}
            </View>
          </>
        ) : confirmDelete ? (
          <>
            <Text style={{ color: theme.textMuted, marginVertical: 8 }}>{t.deleteBody(book?.title ?? '')}</Text>
            <View style={styles.row}>
              {action(t.cancel, () => setConfirmDelete(false))}
              {action(t.delete, onDelete, true)}
            </View>
          </>
        ) : (
          <>
            {action(t.rename, () => setRenaming(true))}
            {action(book?.finished ? t.markUnread : t.markRead, onToggleRead)}
            {action(t.delete, () => setConfirmDelete(true), true)}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontSize: 16, fontWeight: '500' },
});
