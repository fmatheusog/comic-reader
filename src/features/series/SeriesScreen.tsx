import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  deleteBookRow,
  listSeriesBooks,
  setFinished,
  updateBookInfo,
  type Book,
} from '@/entities/book/db';
import { resumeChapter } from '@/entities/book/group';
import { removeBookFiles, resolveUri } from '@/entities/book/storage';
import { BookActionsModal } from '@/entities/book/ui/BookActionsModal';
import { BookEditModal } from '@/entities/book/ui/BookEditModal';
import { SeriesManager } from '@/entities/book/ui/SeriesManager';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';


export default function SeriesScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);
  const [managing, setManaging] = useState(false);

  const refresh = useCallback(async () => {
    setBooks(await listSeriesBooks(name));
    setLoaded(true);
  }, [name]);

  // ao voltar do leitor o progresso mudou
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // sem capítulos (por exemplo, depois de excluir o último), não há o que mostrar
  const emptyAfterLoad = loaded && books.length === 0;
  const resume = resumeChapter(books);
  const started = books.some((b) => b.progress > 0 || b.finished);

  const open = (b: Book) => router.push(`/reader/${b.id}`);

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.back} style={styles.iconBtn}>
          <Text style={{ color: theme.text, fontSize: 26 }}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2} accessibilityRole="header">
          {name}
        </Text>
        <Pressable
          onPress={() => setManaging(true)}
          accessibilityRole="button"
          accessibilityLabel={t.seriesActions}
          style={styles.iconBtn}>
          <Text style={{ color: theme.text, fontSize: 20 }}>✎</Text>
        </Pressable>
      </View>

      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}
        ListHeaderComponent={
          <View style={styles.summary}>
            <Text style={{ color: theme.textMuted }}>{t.chapters(books.length)}</Text>
            {resume && (
              <Pressable
                onPress={() => open(resume)}
                accessibilityRole="button"
                style={[styles.resumeBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.background, fontWeight: '700' }}>
                  {started ? t.continueSeries : t.startSeries}
                  {resume.seriesNumber != null ? ` · ${t.chapterNumber(resume.seriesNumber)}` : ''}
                </Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          emptyAfterLoad ? <Text style={{ color: theme.textMuted, textAlign: 'center', paddingTop: 32 }}>{t.seriesEmpty}</Text> : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            onLongPress={() => setSelected(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.seriesNumber != null ? t.chapterNumber(item.seriesNumber) + ', ' : ''}${item.title}, ${t.percentRead(item.finished ? 1 : item.progress)}`}
            accessibilityHint="Toque para abrir. Toque e segure para mais ações."
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.thumb, { backgroundColor: theme.background }]}>
              {item.coverPath ? (
                <Image source={{ uri: resolveUri(item.coverPath) }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              {item.seriesNumber != null && (
                <Text style={[styles.number, { color: theme.accent }]}>{t.chapterNumber(item.seriesNumber)}</Text>
              )}
              <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {t.formats[item.format]}
                {item.pageCount ? ` · ${item.pageCount}` : ''}
              </Text>
              {!item.finished && item.progress > 0 && (
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${item.progress * 100}%`, backgroundColor: theme.accent }]} />
                </View>
              )}
            </View>
            {item.finished && <Text style={{ color: theme.accent, fontSize: 20 }}>✓</Text>}
          </Pressable>
        )}
      />

      <BookActionsModal
        key={selected?.id ?? 'actions-none'}
        book={selected}
        onClose={() => setSelected(null)}
        onEdit={() => {
          setEditing(selected);
          setSelected(null);
        }}
        onToggleRead={async () => {
          if (selected) await setFinished(selected.id, !selected.finished);
          setSelected(null);
          refresh();
        }}
        onDelete={async () => {
          if (selected) {
            removeBookFiles(selected.id);
            await deleteBookRow(selected.id);
          }
          setSelected(null);
          refresh();
        }}
      />

      <BookEditModal
        key={editing?.id ?? 'edit-none'}
        book={editing}
        onClose={() => setEditing(null)}
        onSave={async (info) => {
          if (editing) await updateBookInfo(editing.id, info);
          setEditing(null);
          refresh();
        }}
      />

      <SeriesManager
        key={`manage-${name}-${managing}`}
        series={managing ? name : null}
        count={books.length}
        onClose={() => setManaging(false)}
        onChanged={() => {
          setManaging(false);
          refresh();
        }}
        onRenamed={(newName) => {
          setManaging(false);
          router.setParams({ name: newName });
        }}
        onDeleted={() => {
          setManaging(false);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  summary: { gap: 12, paddingBottom: 8 },
  resumeBtn: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, minHeight: 72 },
  thumb: { width: 44, height: 64, borderRadius: 4, overflow: 'hidden' },
  number: { fontSize: 12, fontWeight: '700' },
  barTrack: { height: 3, marginTop: 6, backgroundColor: 'rgba(128,128,128,0.3)', borderRadius: 2 },
  barFill: { height: 3, borderRadius: 2 },
});
