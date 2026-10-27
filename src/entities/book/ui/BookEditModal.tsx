import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Book, BookInfo } from '@/entities/book/db';
import { parseChapterNumber, validateInfo } from '@/entities/book/series';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

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
  const [series, setSeries] = useState(book?.series ?? '');
  const [number, setNumber] = useState(book?.seriesNumber != null ? String(book.seriesNumber) : '');

  const keyboard = useKeyboardHeight();
  const error = validateInfo({ title, series, number });

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <Modal visible={!!book} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.close} />
      <View pointerEvents="box-none" style={[styles.avoid, { paddingBottom: keyboard }]}>
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
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.fieldSeries}</Text>
            <TextInput
              value={series}
              onChangeText={setSeries}
              placeholder={t.fieldSeriesHint}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t.fieldSeries}
              style={inputStyle}
            />
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.fieldNumber}</Text>
            <TextInput
              value={number}
              onChangeText={setNumber}
              keyboardType="decimal-pad"
              accessibilityLabel={t.fieldNumber}
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
          {error && <Text style={styles.error}>{error === 'title' ? t.titleRequired : t.numberRequired}</Text>}
          <View style={styles.row}>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.action}>
              <Text style={[styles.actionText, { color: theme.text }]}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => !error && onSave({ title, author, description, series, seriesNumber: parseChapterNumber(number) })}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!error }}
              style={[styles.action, error ? { opacity: 0.4 } : null]}>
              <Text style={[styles.actionText, { color: theme.accent }]}>{t.save}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  error: { color: '#D93025', fontSize: 12, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { fontSize: 16, fontWeight: '600' },
});
