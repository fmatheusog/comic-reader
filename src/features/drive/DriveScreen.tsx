import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

import { crawlFolder, getFolderName } from './api';
import { restoreSession, signIn, signOut, type DriveAccount } from './auth';
import { clearCatalog, loadCatalog, loadRoot, saveCatalog, saveRoot, type CatalogRoot } from './catalogStore';
import { configuredFolderId } from './folderConfig';
import { FolderPicker } from './FolderPicker';
import { ImportStatus } from './ImportStatus';
import { buildWorks, pendingFiles, workProgress, type Catalog, type Work } from './model';
import { useDriveImport } from './useDriveImport';
import { useImported } from './useImported';
import { WorkCard } from './WorkCard';

const GAP = 14;
type StatusFilter = 'all' | 'new' | 'partial' | 'complete';
const STATUS_FILTERS: StatusFilter[] = ['all', 'new', 'partial', 'complete'];

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Com pasta fixa no .env, ela vale sempre; se mudou, o catálogo antigo é descartado. */
async function resolveRoot(stored: CatalogRoot | null): Promise<CatalogRoot | null> {
  const fixed = configuredFolderId();
  if (!fixed) return stored;
  if (stored?.id === fixed) return stored;
  await clearCatalog();
  const name = await getFolderName(fixed).catch(() => t.drive.title);
  const next = { id: fixed, name };
  await saveRoot(next);
  return next;
}

/** Catálogo da sua biblioteca no Drive: as obras da pasta escolhida, organizadas, prontas para importar. */
export default function DriveScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { imported, covers, reload } = useImported();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const importer = useDriveImport(() => {
    setSelected(new Set());
    reload();
  });

  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<DriveAccount | null>(null);
  const [root, setRoot] = useState<CatalogRoot | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [crawling, setCrawling] = useState<{ folders: number; files: number } | null>(null);
  const [crawlSeconds, setCrawlSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const abort = useRef<AbortController | null>(null);

  const fixedFolder = configuredFolderId();

  /** Lê a pasta do catálogo no Drive e guarda o resultado no aparelho. */
  const crawl = async (target: CatalogRoot) => {
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setCrawling({ folders: 0, files: 0 });
    const startedAt = Date.now();
    try {
      const { tree, ignored, folders } = await crawlFolder(target, (folders, files) => setCrawling({ folders, files }), controller.signal);
      const next: Catalog = { builtAt: Date.now(), works: buildWorks(tree), ignored, folders };
      await saveCatalog(next);
      setCatalog(next);
      setCrawlSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    } catch (e) {
      if (errorText(e) !== 'cancelado') setError(errorText(e));
    } finally {
      setCrawling(null);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const acc = await restoreSession();
      const [stored, storedCatalog] = await Promise.all([loadRoot(), loadCatalog()]);
      const r = acc ? await resolveRoot(stored).catch(() => stored) : stored;
      const c = r?.id === stored?.id ? storedCatalog : null;
      if (!alive) return;
      setAccount(acc);
      setRoot(r);
      setCatalog(c);
      setReady(true);
      if (acc && r && !c) crawl(r);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const doSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      const acc = await signIn();
      setAccount(acc);
      if (acc) {
        const r = await resolveRoot(root);
        setRoot(r);
        if (r && (r.id !== root?.id || !catalog)) {
          setCatalog(null);
          crawl(r);
        }
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSigningIn(false);
    }
  };

  // sair esquece também a pasta e o catálogo guardados no aparelho
  const doSignOut = async () => {
    abort.current?.abort();
    await signOut();
    await clearCatalog();
    setAccount(null);
    setRoot(null);
    setCatalog(null);
    setSelected(new Set());
  };

  const changeFolder = async () => {
    abort.current?.abort();
    await clearCatalog();
    setRoot(null);
    setCatalog(null);
    setSelected(new Set());
  };

  const pickRoot = async (picked: CatalogRoot) => {
    await saveRoot(picked);
    setRoot(picked);
    crawl(picked);
  };

  const works = catalog?.works ?? [];
  const ignoredList = Object.entries(catalog?.ignored ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const ignoredText = ignoredList.length ? t.drive.ignored(ignoredList.map(([k, n]) => `${k} (${n})`).join(', ')) : null;
  const categories = [...new Set(works.map((w) => w.category).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  const q = search.trim().toLowerCase();
  const visible = works.filter((w) => {
    if (q && !w.name.toLowerCase().includes(q)) return false;
    if (category !== null && (category === '' ? w.category !== null : w.category !== category)) return false;
    const p = workProgress(w, imported);
    if (filter === 'new') return p.untouched;
    if (filter === 'partial') return !p.untouched && !p.complete;
    if (filter === 'complete') return p.complete;
    return true;
  });

  const sidePad = Math.max(16, insets.left + 16, insets.right + 16);
  const columns = Math.max(3, Math.floor((width - sidePad * 2 + GAP) / (130 + GAP)));
  const cardWidth = Math.floor((width - sidePad * 2 - GAP * (columns - 1)) / columns);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const coverOf = (w: Work) => {
    const hit = w.files.find((f) => covers.has(f.id));
    return hit ? covers.get(hit.id) : undefined;
  };

  const selectedWorks = works.filter((w) => selected.has(w.id));
  const pendingCount = selectedWorks.reduce((n, w) => n + pendingFiles(w, imported).length, 0);

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, { backgroundColor: active ? theme.accent : theme.surface, borderColor: theme.border }]}>
      <Text style={{ color: active ? theme.background : theme.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  const header = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.back} style={styles.iconBtn}>
        <Text style={{ color: theme.text, fontSize: 26 }}>‹</Text>
      </Pressable>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
        {root && account ? root.name : t.drive.title}
      </Text>
      {account && root && catalog && !crawling && (
        <Pressable onPress={() => crawl(root)} accessibilityRole="button" accessibilityLabel={t.drive.refresh} style={styles.iconBtn}>
          <Text style={{ color: theme.text, fontSize: 20 }}>↻</Text>
        </Pressable>
      )}
    </View>
  );

  let body;
  if (!ready) {
    body = <ActivityIndicator color={theme.accent} style={{ marginTop: 48 }} />;
  } else if (!account) {
    body = (
      <View style={styles.center}>
        <Text style={{ color: theme.textMuted, textAlign: 'center', lineHeight: 20 }}>{t.drive.intro}</Text>
        <Pressable
          onPress={doSignIn}
          disabled={signingIn}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: theme.accent }]}>
          {signingIn ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={{ color: theme.background, fontWeight: '700' }}>{t.drive.signIn}</Text>
          )}
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  } else if (!root) {
    body = <FolderPicker account={account.email} onPick={pickRoot} />;
  } else if (crawling && !catalog) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
        <Text style={{ color: theme.text, fontWeight: '600' }}>{t.drive.crawling}</Text>
        <Text style={{ color: theme.textMuted }}>{t.drive.crawlProgress(crawling.folders, crawling.files)}</Text>
        <Pressable onPress={() => abort.current?.abort()} accessibilityRole="button" style={styles.textBtn}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>{t.drive.cancel}</Text>
        </Pressable>
      </View>
    );
  } else if (!catalog) {
    body = (
      <View style={styles.center}>
        <Text style={styles.error}>{error ? `${t.drive.loadError} ${error}` : t.drive.loadError}</Text>
        <Pressable onPress={() => crawl(root)} accessibilityRole="button" style={[styles.primary, { backgroundColor: theme.accent }]}>
          <Text style={{ color: theme.background, fontWeight: '700' }}>{t.drive.retry}</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <FlatList
        key={columns}
        data={visible}
        numColumns={columns}
        keyExtractor={(w) => w.id}
        extraData={[imported, covers, selected]}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ paddingHorizontal: sidePad, paddingBottom: 96 + insets.bottom, gap: GAP }}
        ListHeaderComponent={
          <View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t.drive.search}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t.drive.search}
              style={[styles.search, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {STATUS_FILTERS.map((f) => chip(t.drive.filters[f], filter === f, () => setFilter(f)))}
              {categories.length > 0 && <View style={{ width: 12 }} />}
              {categories.length > 0 && chip(t.drive.allCategories, category === null, () => setCategory(null))}
              {categories.map((c) => chip(c, category === c, () => setCategory(c)))}
              {categories.length > 0 && works.some((w) => !w.category) && chip(t.drive.otherCategory, category === '', () => setCategory(''))}
            </ScrollView>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8 }}>
              {t.drive.summary(works.length, works.reduce((n, w) => n + w.files.length, 0), new Date(catalog.builtAt).toLocaleDateString('pt-BR'), crawlSeconds, catalog.folders ?? null)}
            </Text>
            {ignoredText && <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8 }}>{ignoredText}</Text>}
            {crawling && (
              <View style={styles.refreshing}>
                <ActivityIndicator color={theme.accent} />
                <Text style={{ color: theme.textMuted, flex: 1, fontSize: 12 }}>{t.drive.refreshing(crawling.folders, crawling.files)}</Text>
                <Pressable onPress={() => abort.current?.abort()} accessibilityRole="button" style={styles.textBtn}>
                  <Text style={{ color: theme.text, fontWeight: '600' }}>{t.drive.cancel}</Text>
                </Pressable>
              </View>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            <ImportStatus status={importer.status} failedCount={importer.failedCount} onRetry={importer.retryFailed} />
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: theme.textMuted, textAlign: 'center', paddingTop: 32 }}>
            {works.length === 0 ? t.drive.catalogEmpty : t.emptyFiltered}
          </Text>
        }
        renderItem={({ item }) => (
          <WorkCard
            work={item}
            width={cardWidth}
            done={workProgress(item, imported).done}
            coverPath={coverOf(item)}
            selected={selected.has(item.id)}
            onPress={() => (selected.size > 0 ? toggle(item.id) : router.push(`/drive/${encodeURIComponent(item.id)}`))}
            onLongPress={() => toggle(item.id)}
          />
        )}
        ListFooterComponent={
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 16 }}>
            {!fixedFolder && (
              <Pressable onPress={changeFolder} accessibilityRole="button" style={styles.textBtn}>
                <Text style={{ color: theme.textMuted, fontWeight: '600' }}>{t.drive.changeFolder}</Text>
              </Pressable>
            )}
            <Pressable onPress={doSignOut} accessibilityRole="button" style={styles.textBtn}>
              <Text style={{ color: theme.textMuted, fontWeight: '600' }}>{t.drive.signOutShort(account.email)}</Text>
            </Pressable>
          </View>
        }
      />
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {header}
      {body}

      {selected.size > 0 && !importer.busy && (
        <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
          <Pressable onPress={() => setSelected(new Set())} accessibilityRole="button" style={styles.textBtn}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{t.drive.clearSelection}</Text>
          </Pressable>
          <Text style={{ color: theme.textMuted, flex: 1, fontSize: 12 }} numberOfLines={2}>
            {t.drive.selectedWorks(selected.size, pendingCount)}
          </Text>
          <Pressable
            onPress={() => importer.begin(selectedWorks.flatMap((w) => pendingFiles(w, imported)))}
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: theme.accent }]}>
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
  title: { flex: 1, fontSize: 22, fontWeight: '700' },
  textBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  center: { alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 32 },
  primary: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#D93025', textAlign: 'center', marginBottom: 8 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15 },
  chips: { gap: 8, paddingVertical: 12 },
  refreshing: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});

