import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { validateInfo } from '@/entities/book/series';
import { t } from '@/shared/i18n/pt';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { useAppTheme } from '@/shared/theme';

import type { ImportDraft } from '@/entities/book/importer';

type Props = {
  /** Lote a revisar; null fecha a tela. Troque a `key` a cada lote. */
  drafts: ImportDraft[] | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (drafts: ImportDraft[]) => void;
};

/** Confere título, obra e número de cada arquivo antes de importar. Com obra, o número é obrigatório. */
export function ImportReviewModal({ drafts, busy, onCancel, onConfirm }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const [rows, setRows] = useState<ImportDraft[]>(drafts ?? []);
  const [allSeries, setAllSeries] = useState('');

  const patch = (index: number, change: Partial<ImportDraft>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...change } : r)));

  const invalid = rows.filter((r) => validateInfo(r) != null).length;
  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <Modal visible={!!drafts} animationType="slide" onRequestClose={busy ? undefined : onCancel} statusBarTranslucent>
      <View
        style={[
          styles.screen,
          { backgroundColor: theme.background, paddingTop: insets.top + 8, paddingBottom: Math.max(keyboard, insets.bottom) },
        ]}>
        <View style={styles.header}>
          <Text style={[styles.heading, { color: theme.text }]} accessibilityRole="header">
            {t.reviewTitle}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>{t.reviewBody}</Text>
          {rows.length > 1 && (
            <View style={styles.applyRow}>
              <TextInput
                value={allSeries}
                onChangeText={setAllSeries}
                placeholder={t.setSeriesAll}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t.setSeriesAll}
                style={[...inputStyle, { flex: 1 }]}
              />
              <Pressable
                onPress={() => allSeries.trim() && setRows((prev) => prev.map((r) => ({ ...r, series: allSeries.trim() })))}
                accessibilityRole="button"
                style={styles.textBtn}>
                <Text style={[styles.btnText, { color: theme.accent }]}>{t.applyAll}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => r.sourceId ?? r.uri}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
          renderItem={({ item, index }) => {
            const error = validateInfo(item);
            return (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: error ? '#D93025' : theme.border }]}>
                <Text style={{ color: theme.textMuted, fontSize: 11 }} numberOfLines={1}>
                  {item.name}
                </Text>
                <TextInput
                  value={item.title}
                  onChangeText={(v) => patch(index, { title: v })}
                  placeholder={t.fieldTitle}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t.fieldTitle}
                  style={inputStyle}
                />
                <View style={styles.pair}>
                  <TextInput
                    value={item.series}
                    onChangeText={(v) => patch(index, { series: v })}
                    placeholder={t.fieldSeriesShort}
                    placeholderTextColor={theme.textMuted}
                    accessibilityLabel={t.fieldSeries}
                    style={[...inputStyle, { flex: 1 }]}
                  />
                  <TextInput
                    value={item.number}
                    onChangeText={(v) => patch(index, { number: v })}
                    placeholder={t.fieldNumberShort}
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    accessibilityLabel={t.fieldNumber}
                    style={[...inputStyle, styles.numberInput]}
                  />
                </View>
                {error && (
                  <Text style={styles.error}>{error === 'title' ? t.titleRequired : t.numberRequired}</Text>
                )}
              </View>
            );
          }}
        />

        <View style={[styles.footer, { borderColor: theme.border }]}>
          <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" style={styles.textBtn}>
            <Text style={[styles.btnText, { color: theme.text }]}>{t.cancel}</Text>
          </Pressable>
          <Pressable
            onPress={() => invalid === 0 && !busy && onConfirm(rows)}
            accessibilityRole="button"
            accessibilityState={{ disabled: invalid > 0 || busy }}
            style={[styles.confirm, { backgroundColor: theme.accent, opacity: invalid > 0 || busy ? 0.4 : 1 }]}>
            <Text style={{ color: theme.background, fontWeight: '700' }}>{busy ? t.importing : t.importN(rows.length)}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  heading: { fontSize: 20, fontWeight: '700' },
  applyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  pair: { flexDirection: 'row', gap: 8 },
  numberInput: { width: 84, textAlign: 'center' },
  error: { color: '#D93025', fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  textBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 15, fontWeight: '600' },
  confirm: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
});
