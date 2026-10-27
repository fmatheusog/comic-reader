import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Book, BookInfo } from '@/db/books';
import { t } from '@/i18n/pt';
import { useAppTheme } from '@/theme';

type Props = {
  book: Book | null;
  onClose: () => void;
  onSave: (info: BookInfo) => void;
};

export function BookEditModal({ book, onClose, onSave }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [description, setDescription] = useState(book?.description ?? '');

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <Modal visible={!!book} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
        style={styles.avoid}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + 12, borderColor: theme.border },
          ]}>
          <Text style={[styles.heading, { color: theme.text }]}>{t.editInfoTitle}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.fieldTitle}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              accessibilityLabel={t.fieldTitle}
              style={inputStyle}
            />
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.fieldAuthor}</Text>
            <TextInput
              value={author}
              onChangeText={setAuthor}
              accessibilityLabel={t.fieldAuthor}
              style={inputStyle}
            />
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.fieldDescription}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              accessibilityLabel={t.fieldDescription}
              style={[...inputStyle, styles.multiline]}
            />
          </ScrollView>
          <View style={styles.row}>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.action}>
              <Text style={[styles.actionText, { color: theme.text }]}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => title.trim() && onSave({ title, author, description })}
              accessibilityRole="button"
              style={styles.action}>
              <Text style={[styles.actionText, { color: theme.accent }]}>{t.save}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  avoid: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, marginTop: 4 },
  multiline: { minHeight: 110 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { fontSize: 16, fontWeight: '600' },
});
