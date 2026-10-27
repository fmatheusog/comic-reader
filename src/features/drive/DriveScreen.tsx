import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSourceIds } from '@/entities/book/db';
import { buildDraft, importDraft, type ImportDraft, type ImportOutcome } from '@/entities/book/importer';
import { ImportReviewModal } from '@/entities/book/ui/ImportReviewModal';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

import { clearDriveCache, collectFiles, downloadFile, listFolder, listSharedWithMe, type RemoteFile } from './api';
import { restoreSession, signIn, signOut, type DriveAccount } from './auth';
import { formatBytes, type DriveEntry } from './model';

/** Um nível da navegação; 'shared' é a lista "Compartilhados comigo". */
type Frame = { id: string; name: string };
const SHARED = 'shared';

type Progress = { index: number; total: number; name: string; received: number; totalBytes: number };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function DriveScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [account, setAccount] = useState<DriveAccount | null | undefined>(undefined);
  const [signingIn, setSigningIn] = useState(false);
  const [stack, setStack] = useState<Frame[]>([]);
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, DriveEntry>>(new Map());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [review, setReview] = useState<ImportDraft[] | null>(null);
  const [batch, setBatch] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);

  const abort = useRef<AbortController | null>(null);
  const sizes = useRef(new Map<string, number | null>());

  useEffect(() => {
    restoreSession().then(setAccount);
    listSourceIds().then(setImported);
  }, []);

  const top = stack[stack.length - 1];

  const load = useCallback(async (frame: Frame | undefined) => {
    if (!frame) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(frame.id === SHARED ? await listSharedWithMe() : await listFolder(frame.id));
    } catch (e) {
      setEntries([]);
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const go = (frames: Frame[]) => {
    setStack(frames);
    setSelected(new Map());
    setStatus(null);
    if (frames.length) load(frames[frames.length - 1]);
    else setEntries([]);
  };

  // o botão voltar do Android sobe um nível antes de sair da tela
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (progress) return true;
      if (stack.length === 0) return false;
      go(stack.slice(0, -1));
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, progress]);

  const doSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      setAccount(await signIn());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSigningIn(false);
    }
  };

  const doSignOut = async () => {
    await signOut();
    setAccount(null);
    go([]);
  };

  const toggle = (e: DriveEntry) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(e.id)) next.delete(e.id);
      else next.set(e.id, e);
      return next;
    });

  const importable = entries.filter((e) => e.kind === 'file' && !imported.has(e.id));
  const selectAllFiles = () => setSelected(new Map(importable.map((e) => [e.id, e])));

  // 1) junta os arquivos escolhidos (e o que há dentro das pastas) e abre a revisão
  const startImport = async () => {
    abort.current = new AbortController();
    setStatus(t.drive.reading(0));
    try {
      const remote: RemoteFile[] = [];
      let base = 0;
      for (const e of selected.values()) {
        if (e.kind === 'file') {
          // arquivo solto: a obra sugerida é a pasta em que ele está (nada, se estiver na raiz)
          const folderName = top && top.id !== SHARED && top.id !== 'root' ? top.name : '';
          remote.push({ id: e.id, name: e.name, format: e.format, size: e.size, folderName });
        } else {
          const found = await collectFiles(e, (n) => setStatus(t.drive.reading(base + n)), abort.current.signal);
          base += found.length;
          remote.push(...found);
        }
      }
      const fresh = remote.filter((f) => !imported.has(f.id));
      const skipped = remote.length - fresh.length;
      if (fresh.length === 0) {
        setStatus(t.drive.nothingNew);
        return;
      }
      setStatus(skipped ? t.drive.alreadyImported(skipped) : null);
      sizes.current = new Map(fresh.map((f) => [f.id, f.size]));
      setBatch((n) => n + 1);
      setReview(
        fresh.map((f) => ({ ...buildDraft('', f.name, f.format, f.folderName || undefined), sourceId: f.id })),
      );
    } catch (e) {
      setStatus(errorText(e) === 'cancelado' ? t.drive.cancelled : errorText(e));
    }
  };

  // 2) depois de conferir, baixa e importa um por vez (o cache nunca guarda mais que um arquivo)
  const runImport = async (drafts: ImportDraft[]) => {
    setReview(null);
    const controller = new AbortController();
    abort.current = controller;
    const outcomes: ImportOutcome[] = [];
    try {
      for (let i = 0; i < drafts.length; i++) {
        if (controller.signal.aborted) break;
        const d = drafts[i];
        setProgress({ index: i + 1, total: drafts.length, name: d.name, received: 0, totalBytes: sizes.current.get(d.sourceId ?? '') ?? -1 });
        try {
          const file = await downloadFile(
            { id: d.sourceId ?? '', name: d.name },
            (received, totalBytes) =>
              setProgress((p) => (p ? { ...p, received, totalBytes: totalBytes > 0 ? totalBytes : p.totalBytes } : p)),
            controller.signal,
          );
          outcomes.push(await importDraft({ ...d, uri: file.uri }));
        } catch (e) {
          if (controller.signal.aborted) break;
          outcomes.push({ name: d.name, ok: false, error: errorText(e) });
        }
      }
    } finally {
      clearDriveCache();
      setProgress(null);
      setImported(await listSourceIds());
      setSelected(new Map());
      const ok = outcomes.filter((o) => o.ok).length;
      const firstError = outcomes.find((o) => !o.ok)?.error;
      const cancelled = controller.signal.aborted ? ` ${t.drive.cancelled}` : '';
      setStatus(t.importDone(ok, outcomes.length - ok) + (firstError ? ` (${firstError})` : '') + cancelled);
    }
  };

  const title = top ? top.name : t.drive.title;
  const busy = !!progress;

  const header = (
    <View style={styles.topBar}>
      <Pressable
        onPress={() => (stack.length ? go(stack.slice(0, -1)) : router.back())}
        accessibilityRole="button"
        accessibilityLabel={t.back}
        style={styles.iconBtn}>
        <Text style={{ color: theme.text, fontSize: 26 }}>‹</Text>
      </Pressable>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {account && (
        <Pressable onPress={doSignOut} accessibilityRole="button" style={styles.textBtn}>
          <Text style={{ color: theme.textMuted, fontWeight: '600' }}>{t.drive.signOut}</Text>
        </Pressable>
      )}
    </View>
  );

  let body;
  if (account === undefined) {
    body = <ActivityIndicator color={theme.accent} style={{ marginTop: 48 }} />;
  } else if (account === null) {
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
  } else if (!top) {
    body = (
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>{t.drive.signedAs(account.email)}</Text>
        {[
          { id: SHARED, name: t.drive.sharedWithMe },
          { id: 'root', name: t.drive.myDrive },
        ].map((f) => (
          <Pressable
            key={f.id}
            onPress={() => go([f])}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ fontSize: 20 }}>📁</Text>
            <Text style={{ color: theme.text, fontWeight: '600', flex: 1 }}>{f.name}</Text>
          </Pressable>
        ))}
      </View>
    );
  } else {
    body = (
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        extraData={[selected, imported]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 + insets.bottom, gap: 8 }}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {importable.length > 0 && (
              <Pressable onPress={selected.size ? () => setSelected(new Map()) : selectAllFiles} accessibilityRole="button" style={styles.textBtn}>
                <Text style={{ color: theme.accent, fontWeight: '600' }}>
                  {selected.size ? t.drive.clearSelection : t.drive.selectAll}
                </Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{t.drive.loadError}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>{error}</Text>
              <Pressable onPress={() => load(top)} accessibilityRole="button" style={styles.textBtn}>
                <Text style={{ color: theme.accent, fontWeight: '600' }}>{t.drive.retry}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ color: theme.textMuted, textAlign: 'center', paddingTop: 32 }}>{t.drive.folderEmpty}</Text>
          )
        }
        renderItem={({ item }) => {
          const done = item.kind === 'file' && imported.has(item.id);
          const on = selected.has(item.id);
          return (
            <Pressable
              onPress={() => (item.kind === 'folder' ? go([...stack, { id: item.id, name: item.name }]) : !done && toggle(item))}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: done }}
              style={[styles.row, { backgroundColor: theme.surface, borderColor: on ? theme.accent : theme.border, opacity: done ? 0.55 : 1 }]}>
              <Text style={{ fontSize: 20 }}>{item.kind === 'folder' ? '📁' : '📄'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.kind === 'file' && (
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                    {t.formats[item.format]}
                    {item.size ? ` · ${formatBytes(item.size)}` : ''}
                    {done ? ` · ${t.drive.imported}` : ''}
                  </Text>
                )}
              </View>
              {!done && (
                <Pressable
                  onPress={() => toggle(item)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={styles.check}>
                  <Text style={{ color: on ? theme.accent : theme.textMuted, fontSize: 22 }}>{on ? '☑' : '☐'}</Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {header}
      {status && <Text style={{ color: theme.textMuted, paddingHorizontal: 16, paddingBottom: 8 }}>{status}</Text>}
      {body}

      {selected.size > 0 && !busy && (
        <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
          <Text style={{ color: theme.text, flex: 1, fontWeight: '600' }}>{t.drive.selected(selected.size)}</Text>
          <Pressable onPress={startImport} accessibilityRole="button" style={[styles.primary, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.background, fontWeight: '700' }}>{t.drive.importSelected}</Text>
          </Pressable>
        </View>
      )}

      <ImportReviewModal
        key={`review-${batch}`}
        drafts={review}
        busy={false}
        onCancel={() => setReview(null)}
        onConfirm={runImport}
      />

      <Modal visible={busy} transparent animationType="fade" statusBarTranslucent onRequestClose={() => abort.current?.abort()}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {progress && (
              <>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{t.drive.downloading(progress.index, progress.total)}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 13 }} numberOfLines={2}>
                  {progress.name}
                </Text>
                <View style={[styles.track, { backgroundColor: theme.border }]}>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.accent,
                      width: `${progress.totalBytes > 0 ? Math.min(100, (progress.received / progress.totalBytes) * 100) : 0}%`,
                    }}
                  />
                </View>
                <Pressable onPress={() => abort.current?.abort()} accessibilityRole="button" style={styles.textBtn}>
                  <Text style={{ color: theme.text, fontWeight: '600' }}>{t.drive.cancel}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  textBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  center: { alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 32 },
  primary: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#D93025', textAlign: 'center' },
  listHeader: { flexDirection: 'row', justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, minHeight: 56 },
  check: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 16, gap: 10, borderWidth: StyleSheet.hairlineWidth },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
