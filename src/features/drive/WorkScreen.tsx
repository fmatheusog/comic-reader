import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/shared/i18n/pt';
import { formatBytes } from '@/shared/utils/bytes';
import { useAppTheme } from '@/shared/theme';

import { loadCatalog } from './catalogStore';
import { pendingFiles, workProgress, type CatalogFile, type Work } from './model';
import { useDriveImport } from './useDriveImport';
import { useImported } from './useImported';

/** Uma obra do catálogo: capítulos na ordem, com o que já foi importado, e importação de tudo ou só do que falta. */
export default function WorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { imported, reload } = useImported();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const importer = useDriveImport(() => {
    setSelected(new Set());
    reload();
  });

  const [work, setWork] = useState<Work | null | undefined>(undefined);

  useEffect(() => {
    loadCatalog().then((c) => setWork(c?.works.find((w) => w.id === id) ?? null));
  }, [id]);

  const toggle = (fileId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });

  const back = (
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.back} style={styles.iconBtn}>
      <Text style={{ color: theme.text, fontSize: 26 }}>‹</Text>
    </Pressable>
  );

  if (work === undefined) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={styles.topBar}>{back}</View>
        <ActivityIndicator color={theme.accent} style={{ marginTop: 48 }} />
      </View>
    );
  }
  if (work === null) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={styles.topBar}>{back}</View>
        <Text style={{ color: theme.textMuted, textAlign: 'center', padding: 24 }}>{t.drive.workNotFound}</Text>
      </View>
    );
  }

  const progress = workProgress(work, imported);
  const pending = pendingFiles(work, imported);
  const chosen = work.files.filter((f) => selected.has(f.id));

  const importFiles = (files: CatalogFile[]) =>
    importer.begin(
      files.map((f) => ({ ...f, folderName: pending.find((p) => p.id === f.id)?.folderName ?? '' })),
    );

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        {back}
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2} accessibilityRole="header">
          {work.name}
        </Text>
      </View>

      <FlatList
        data={work.files}
        keyExtractor={(f) => f.id}
        extraData={[selected, imported]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 + insets.bottom, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <Text style={{ color: theme.textMuted }}>
              {work.category ? `${work.category} · ` : ''}
              {t.drive.importedOf(progress.done, progress.total)}
            </Text>
            {pending.length > 0 && selected.size === 0 && (
              <Pressable
                onPress={() => importFiles(pending)}
                accessibilityRole="button"
                style={[styles.primary, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.background, fontWeight: '700' }}>
                  {progress.untouched ? t.drive.importAll(pending.length) : t.drive.importMissing(pending.length)}
                </Text>
              </Pressable>
            )}
            {importer.status && <Text style={{ color: theme.textMuted }}>{importer.status}</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const done = imported.has(item.id);
          const on = selected.has(item.id);
          return (
            <Pressable
              onPress={() => !done && toggle(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: done }}
              style={[styles.row, { backgroundColor: theme.surface, borderColor: on ? theme.accent : theme.border, opacity: done ? 0.55 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  {t.formats[item.format]}
                  {item.size ? ` · ${formatBytes(item.size)}` : ''}
                  {done ? ` · ${t.drive.imported}` : ''}
                </Text>
              </View>
              {done ? (
                <Text style={{ color: theme.accent, fontSize: 20 }}>✓</Text>
              ) : (
                <Text style={{ color: on ? theme.accent : theme.textMuted, fontSize: 22 }}>{on ? '☑' : '☐'}</Text>
              )}
            </Pressable>
          );
        }}
      />

      {chosen.length > 0 && !importer.busy && (
        <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
          <Pressable onPress={() => setSelected(new Set())} accessibilityRole="button" style={styles.textBtn}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{t.drive.clearSelection}</Text>
          </Pressable>
          <Text style={{ color: theme.textMuted, flex: 1 }}>{t.drive.selected(chosen.length)}</Text>
          <Pressable onPress={() => importFiles(chosen)} accessibilityRole="button" style={[styles.primary, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.background, fontWeight: '700' }}>{t.drive.importSelected}</Text>
          </Pressable>
        </View>
      )}

      {importer.ui}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  textBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  primary: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, minHeight: 56 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
