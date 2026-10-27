import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  name: string;
  onClose: () => void;
  onSave: (name: string) => void;
};

/** Diálogo no topo da tela, para o teclado nunca cobrir o campo. */
export function RenameSeriesModal({ visible, name, onClose, onSave }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(name);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.close} />
      <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + 56 }]}>
        <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.heading, { color: theme.text }]}>{t.renameSeries}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>{t.renameSeriesBody}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            accessibilityLabel={t.series}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <View style={styles.row}>
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.action}>
              <Text style={[styles.actionText, { color: theme.text }]}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => value.trim() && onSave(value.trim())}
              accessibilityRole="button"
              style={styles.action}>
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
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 16 },
  dialog: { width: '100%', maxWidth: 560, borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  heading: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { fontSize: 16, fontWeight: '600' },
});
