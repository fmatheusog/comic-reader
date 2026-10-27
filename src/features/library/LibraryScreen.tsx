import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookActionsModal } from '@/entities/book/ui/BookActionsModal';
import { BookCard } from '@/entities/book/ui/BookCard';
import { SeriesCard } from './SeriesCard';
import { BookEditModal } from '@/entities/book/ui/BookEditModal';
import { deleteBookRow, setFinished, updateBookInfo, type Book, type Filter, type SortKey } from '@/entities/book/db';
import { useLibrary } from '@/features/library/useLibrary';
import { t } from '@/shared/i18n/pt';
import { discardDrafts, importDrafts, pickDrafts, type ImportDraft } from '@/entities/book/importer';
import { ImportReviewModal } from '@/entities/book/ui/ImportReviewModal';
import { removeBookFiles } from '@/entities/book/storage';
import { useAppTheme } from '@/shared/theme';

const FILTERS: Filter[] = ['all', 'reading', 'new', 'read'];
const SORTS: SortKey[] = ['recent', 'title', 'added'];
const GAP = 14;

export default function LibraryScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selected, setSelected] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);
  const [importing, setImporting] = useState(false);
  const [reviewing, setReviewing] = useState<ImportDraft[] | null>(null);
  const [batch, setBatch] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const { items, continueList, loaded, refresh } = useLibrary(search, filter, sort);

  const sidePad = Math.max(16, insets.left + 16, insets.right + 16);
  const columns = Math.max(3, Math.floor((width - sidePad * 2 + GAP) / (130 + GAP)));
  const cardWidth = Math.floor((width - sidePad * 2 - GAP * (columns - 1)) / columns);

  const open = (b: Book) => router.push(`/reader/${b.id}`);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 8000);
  };

  // 1) escolhe os arquivos e abre a revisão
  const startImport = async () => {
    const { drafts, skipped } = await pickDrafts();
    if (skipped) showMessage(t.skippedFiles(skipped));
    if (drafts.length) {
      setBatch((n) => n + 1);
      setReviewing(drafts);
    }
  };

  // 2) depois de conferir, importa de fato
  const confirmImport = async (drafts: ImportDraft[]) => {
    setImporting(true);
    try {
      const outcomes = await importDrafts(drafts);
      const ok = outcomes.filter((o) => o.ok).length;
      const firstError = outcomes.find((o) => !o.ok)?.error;
      showMessage(t.importDone(ok, outcomes.length - ok) + (firstError ? ` (${firstError})` : ''));
      setReviewing(null);
      await refresh();
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => {
    if (reviewing) discardDrafts(reviewing);
    setReviewing(null);
  };

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        { backgroundColor: active ? theme.accent : theme.surface, borderColor: theme.border },
      ]}>
      <Text style={{ color: active ? theme.background : theme.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  const header = (
    <View>
      {continueList.length > 0 && !search && filter === 'all' && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.section, { color: theme.text }]}>{t.continueReading}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GAP }}>
            {continueList.map((b) => (
              <BookCard key={b.id} book={b} width={cardWidth} onPress={() => open(b)} onLongPress={() => setSelected(b)} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: sidePad }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            {t.library}
          </Text>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t.settings}
            style={styles.gear}>
            <Text style={{ color: theme.text, fontSize: 22 }}>⚙</Text>
          </Pressable>
          <Pressable
            onPress={startImport}
            disabled={importing}
            accessibilityRole="button"
            style={[styles.importBtn, { backgroundColor: theme.accent }]}>
            {importing ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Text style={{ color: theme.background, fontWeight: '700' }}>{t.import}</Text>
            )}
          </Pressable>
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t.search}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t.search}
          style={[styles.search, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => chip(t.filters[f], filter === f, () => setFilter(f)))}
          <View style={{ width: 12 }} />
          {SORTS.map((s) => chip(t.sort[s], sort === s, () => setSort(s)))}
        </ScrollView>
        {message && <Text style={{ color: theme.textMuted, marginBottom: 8 }}>{message}</Text>}
      </View>

      <FlatList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(i) => (i.kind === 'series' ? `series:${i.key}` : i.book.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: sidePad, paddingBottom: insets.bottom + 24, gap: GAP }}
        columnWrapperStyle={{ gap: GAP }}
        renderItem={({ item }) =>
          item.kind === 'series' ? (
            <SeriesCard group={item} width={cardWidth} onPress={() => router.push(`/series/${encodeURIComponent(item.name)}`)} />
          ) : (
            <BookCard book={item.book} width={cardWidth} onPress={() => open(item.book)} onLongPress={() => setSelected(item.book)} />
          )
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {search || filter !== 'all' ? t.emptyFiltered : t.emptyTitle}
              </Text>
              {!search && filter === 'all' && (
                <Text style={{ color: theme.textMuted, textAlign: 'center' }}>{t.emptyBody}</Text>
              )}
            </View>
          ) : undefined
        }
      />

      <ImportReviewModal
        key={`review-${batch}`}
        drafts={reviewing}
        busy={importing}
        onCancel={cancelImport}
        onConfirm={confirmImport}
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
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', flex: 1 },
  gear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  importBtn: { minHeight: 44, minWidth: 96, borderRadius: 22, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  section: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
});
