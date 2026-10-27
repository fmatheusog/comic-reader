import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { renameSeries, setSeriesFinished } from '@/entities/book/db';
import { deleteSeriesCompletely } from '@/entities/book/manage';
import { RenameSeriesModal } from '@/entities/book/ui/RenameSeriesModal';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

type Props = {
  /** Obra a gerenciar; null mantém tudo fechado. Troque a `key` ao mudar de obra. */
  series: string | null;
  /** Quantos capítulos a obra tem (para o aviso de exclusão) */
  count: number;
  onClose: () => void;
  /** Algo mudou (lida, não lida): quem chamou deve recarregar */
  onChanged: () => void;
  /** A obra foi renomeada para este nome */
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
};

/** Menu de ações de uma obra inteira: renomear, marcar como lida ou não lida e excluir. */
export function SeriesManager({ series, count, onClose, onChanged, onRenamed, onDeleted }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const action = (label: string, onPress: () => void, danger = false) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" style={styles.action}>
      <Text style={[styles.actionText, { color: danger ? '#D93025' : theme.text }]}>{label}</Text>
    </Pressable>
  );

  const run = async (op: () => Promise<unknown>, then: () => void) => {
    await op();
    then();
  };

  return (
    <>
      <Modal visible={!!series && !renaming} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.close} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 12 },
          ]}>
          <Text style={[styles.heading, { color: theme.text }]} numberOfLines={2}>
            {series}
          </Text>
          {confirmDelete ? (
            <>
              <Text style={{ color: theme.textMuted, marginVertical: 8 }}>{t.deleteSeriesBody(series ?? '', count)}</Text>
              <View style={styles.row}>
                {action(t.cancel, () => setConfirmDelete(false))}
                {action(t.delete, () => series && run(() => deleteSeriesCompletely(series), onDeleted), true)}
              </View>
            </>
          ) : (
            <>
              {action(t.renameSeries, () => setRenaming(true))}
              {action(t.markSeriesRead, () => series && run(() => setSeriesFinished(series, true), onChanged))}
              {action(t.markSeriesUnread, () => series && run(() => setSeriesFinished(series, false), onChanged))}
              {action(t.deleteSeries, () => setConfirmDelete(true), true)}
            </>
          )}
        </View>
      </Modal>

      <RenameSeriesModal
        key={`rename-${series}-${renaming}`}
        visible={!!series && renaming}
        name={series ?? ''}
        onClose={() => {
          setRenaming(false);
          onClose();
        }}
        onSave={(newName) =>
          series &&
          run(
            () => renameSeries(series, newName),
            () => {
              setRenaming(false);
              onRenamed(newName);
            },
          )
        }
      />
    </>
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
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontSize: 16, fontWeight: '500' },
});
