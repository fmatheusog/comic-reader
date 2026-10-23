import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';

import { setRtl as saveRtl, updateBookMeta, type Book } from '@/db/books';
import { parsePosition, useSaveProgress } from '@/hooks/useSaveProgress';
import { t } from '@/i18n/pt';
import { resolveUri } from '@/services/storage';

import { ChromeButton, ReaderChrome, SeekBar } from './ReaderChrome';

export function PdfReader({ book }: { book: Book }) {
  useKeepAwake();
  const { width, height } = useWindowDimensions();
  const pdfRef = useRef<PdfRef>(null);
  const initial = parsePosition<{ page: number }>(book.position)?.page ?? 1;
  const [page, setPage] = useState(initial);
  const [total, setTotal] = useState(book.pageCount ?? 0);
  const [rtl, setRtl] = useState(book.rtl);
  const [controls, setControls] = useState(false);

  useSaveProgress(book.id, total ? page / total : 0, { page }, total > 0);

  const goTo = (p: number) => {
    const next = Math.min(Math.max(p, 1), total || 1);
    pdfRef.current?.setPage(next);
    setPage(next);
  };

  const onTap = (x: number) => {
    const f = x / width;
    if (f < 0.3) goTo(page + (rtl ? 1 : -1));
    else if (f > 0.7) goTo(page + (rtl ? -1 : 1));
    else setControls((c) => !c);
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden={!controls} style="light" />
      <Pdf
        key={`${width}x${height}`}
        ref={pdfRef}
        source={{ uri: resolveUri(`books/${book.id}/book.pdf`), cache: false }}
        page={page}
        horizontal
        enablePaging
        enableRTL={rtl}
        enableDoubleTapZoom
        fitPolicy={2}
        spacing={0}
        trustAllCerts={false}
        style={styles.pdf}
        onLoadComplete={(n) => {
          setTotal(n);
          updateBookMeta(book.id, { pageCount: n });
        }}
        onPageChanged={(p, n) => {
          setPage(p);
          setTotal(n);
        }}
        onPageSingleTap={(_p, x) => onTap(x)}
        onError={() => {}}
      />
      <ReaderChrome visible={controls} title={book.title} onBack={() => router.back()}>
        <SeekBar
          value={total ? page / total : 0}
          reversed={rtl}
          onSeek={(f) => goTo(Math.round(f * (total - 1)) + 1)}
        />
        <View style={styles.row}>
          <Text style={styles.counter}>{t.pageOf(page, total)}</Text>
          <ChromeButton
            label={t.mangaMode}
            active={rtl}
            onPress={() => {
              setRtl(!rtl);
              saveRtl(book.id, !rtl);
            }}
          />
        </View>
      </ReaderChrome>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  pdf: { flex: 1, backgroundColor: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#fff', fontVariant: ['tabular-nums'] },
});
