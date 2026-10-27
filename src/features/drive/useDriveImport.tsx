import { useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { buildDraft, importDraft, type ImportDraft, type ImportOutcome } from '@/entities/book/importer';
import { ImportReviewModal } from '@/entities/book/ui/ImportReviewModal';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

import { clearDriveCache, downloadFile } from './api';
import type { RemoteFile } from './model';

type Progress = { index: number; total: number; name: string; received: number; totalBytes: number };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Fluxo de importação do Drive: revisão dos dados (obra sugerida = pasta) e depois
 * download + importação, um arquivo por vez, com progresso e cancelamento.
 * Devolve `ui` para renderizar na tela, `begin` para iniciar e a mensagem de `status`.
 */
export function useDriveImport(onFinished: () => void) {
  const theme = useAppTheme();
  const [review, setReview] = useState<ImportDraft[] | null>(null);
  const [batch, setBatch] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sizes = useRef(new Map<string, number | null>());

  const begin = (files: RemoteFile[]) => {
    if (files.length === 0) {
      setStatus(t.drive.nothingNew);
      return;
    }
    setStatus(null);
    sizes.current = new Map(files.map((f) => [f.id, f.size]));
    setBatch((n) => n + 1);
    setReview(files.map((f) => ({ ...buildDraft('', f.name, f.format, f.folderName || undefined), sourceId: f.id })));
  };

  const run = async (drafts: ImportDraft[]) => {
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
      const ok = outcomes.filter((o) => o.ok).length;
      const firstError = outcomes.find((o) => !o.ok)?.error;
      const cancelled = controller.signal.aborted ? ` ${t.drive.cancelled}` : '';
      setStatus(t.importDone(ok, outcomes.length - ok) + (firstError ? ` (${firstError})` : '') + cancelled);
      onFinished();
    }
  };

  const ui: ReactNode = (
    <>
      <ImportReviewModal key={`review-${batch}`} drafts={review} busy={false} onCancel={() => setReview(null)} onConfirm={run} />
      <Modal visible={!!progress} transparent animationType="fade" statusBarTranslucent onRequestClose={() => abort.current?.abort()}>
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
                      backgroundColor: theme.accent,
                      width: `${progress.totalBytes > 0 ? Math.min(100, (progress.received / progress.totalBytes) * 100) : 0}%`,
                    }}
                  />
                </View>
                <Pressable onPress={() => abort.current?.abort()} accessibilityRole="button" style={styles.cancel}>
                  <Text style={{ color: theme.text, fontWeight: '600' }}>{t.drive.cancel}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );

  return { begin, ui, status, setStatus, busy: !!progress };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 16, gap: 10, borderWidth: StyleSheet.hairlineWidth },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  cancel: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
});
