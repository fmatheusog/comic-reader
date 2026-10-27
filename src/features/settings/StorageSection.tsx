import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { listFinishedBooks } from '@/entities/book/db';
import { deleteFinishedBooks } from '@/entities/book/manage';
import { measureLibrary, type LibraryUsage } from '@/entities/book/storageUsage';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';
import { formatBytes } from '@/shared/utils/bytes';

async function loadUsage() {
  const [usage, read] = await Promise.all([measureLibrary(), listFinishedBooks()]);
  return {
    usage,
    finished: { count: read.length, size: read.reduce((sum, b) => sum + (usage.perBook.get(b.id) ?? 0), 0) },
  };
}

/** Espaço usado pelos livros e limpeza dos já lidos. */
export function StorageSection() {
  const theme = useAppTheme();
  const [usage, setUsage] = useState<LibraryUsage | null>(null);
  const [finished, setFinished] = useState<{ count: number; size: number }>({ count: 0, size: 0 });
  const [message, setMessage] = useState<string | null>(null);

  const apply = useCallback((r: Awaited<ReturnType<typeof loadUsage>>) => {
    setUsage(r.usage);
    setFinished(r.finished);
  }, []);

  useEffect(() => {
    let alive = true;
    loadUsage().then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
  }, [apply]);

  const confirmDelete = () =>
    Alert.alert(t.deleteRead, t.deleteReadBody(finished.count, formatBytes(finished.size)), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          const n = await deleteFinishedBooks();
          setMessage(t.storageDone(n));
          setUsage(null);
          loadUsage().then(apply);
        },
      },
    ]);

  return (
    <View>
      <Text style={[styles.group, { color: theme.text }]}>{t.storageGroup}</Text>
      {usage ? (
        <>
          <Text style={{ color: theme.textMuted }}>{t.storageUsed(usage.perBook.size, formatBytes(usage.total))}</Text>
          <Text style={{ color: theme.textMuted, marginTop: 4 }}>
            {finished.count ? t.storageRead(finished.count, formatBytes(finished.size)) : t.storageNoneRead}
          </Text>
          {finished.count > 0 && (
            <Pressable
              onPress={confirmDelete}
              accessibilityRole="button"
              style={[styles.btn, { borderColor: '#D93025' }]}>
              <Text style={{ color: '#D93025', fontWeight: '600' }}>{t.deleteRead}</Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.measuring}>
          <ActivityIndicator color={theme.accent} />
          <Text style={{ color: theme.textMuted }}>{t.storageMeasuring}</Text>
        </View>
      )}
      {message && <Text style={{ color: theme.textMuted, marginTop: 8 }}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 4 },
  btn: { alignSelf: 'flex-start', minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center', marginTop: 12 },
  measuring: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
