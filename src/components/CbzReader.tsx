import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { setRtl as saveRtl, type Book } from '@/db/books';
import { parsePosition, useSaveProgress } from '@/hooks/useSaveProgress';
import { t } from '@/i18n/pt';
import { readExtracted } from '@/services/cbz';
import { resolveUri } from '@/services/storage';
import { buildSpreads, spreadIndexOf } from '@/utils/spreads';

import { ChromeButton, ReaderChrome, SeekBar } from './ReaderChrome';
import { ZoomableView } from './ZoomableView';

export function CbzReader({ book }: { book: Book }) {
  useKeepAwake();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<number[]>>(null);

  const pages = useMemo(() => readExtracted(book.id).pages, [book.id]);
  const [rtl, setRtl] = useState(book.rtl);
  const [dual, setDual] = useState(true);
  const [controls, setControls] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [page, setPage] = useState(() => {
    const saved = parsePosition<{ page: number }>(book.position)?.page ?? 0;
    return Math.min(Math.max(saved, 0), Math.max(pages.length - 1, 0));
  });

  const landscape = width > height;
  const useDual = dual && landscape;
  const spreads = useMemo(() => buildSpreads(pages.length, useDual), [pages.length, useDual]);
  const spreadIdx = spreadIndexOf(spreads, page);

  useSaveProgress(book.id, pages.length ? (page + 1) / pages.length : 0, { page }, pages.length > 0);

  const goTo = (idx: number, animated = true) => {
    const i = Math.min(Math.max(idx, 0), spreads.length - 1);
    listRef.current?.scrollToIndex({ index: i, animated });
    setPage(spreads[i][0]);
  };

  const onTap = (fx: number) => {
    if (fx < 0.3) goTo(spreadIdx + (rtl ? 1 : -1));
    else if (fx > 0.7) goTo(spreadIdx + (rtl ? -1 : 1));
    else setControls((c) => !c);
  };

  const toggleRtl = () => {
    setRtl(!rtl);
    saveRtl(book.id, !rtl);
  };

  if (pages.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff' }}>{t.loadError}</Text>
      </View>
    );
  }

  const renderSpread = ({ item }: { item: number[] }) => (
    <ZoomableView width={width} height={height} onTap={onTap} onZoomChange={setZoomed}>
      <View style={[styles.spread, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {item.map((p) => (
          <Image
            key={p}
            source={{ uri: resolveUri(pages[p]) }}
            style={styles.page}
            contentFit="contain"
            accessibilityLabel={t.pageOf(p + 1, pages.length)}
          />
        ))}
      </View>
    </ZoomableView>
  );

  return (
    <View style={styles.root}>
      <StatusBar hidden={!controls} style="light" />
      <FlatList
        // remonta ao girar a tela ou mudar o sentido, para o scroll inicial cair na página certa
        key={`${width}x${height}-${rtl}-${useDual}`}
        ref={listRef}
        data={spreads}
        horizontal
        pagingEnabled
        inverted={rtl}
        scrollEnabled={!zoomed}
        initialScrollIndex={spreadIdx}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={(s) => s.join('-')}
        renderItem={renderSpread}
        showsHorizontalScrollIndicator={false}
        windowSize={5}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (spreads[i]) setPage(spreads[i][0]);
        }}
      />
      <ReaderChrome visible={controls} title={book.title} onBack={() => router.back()}>
        <SeekBar
          value={(spreadIdx + 1) / spreads.length}
          reversed={rtl}
          onSeek={(f) => goTo(Math.round(f * (spreads.length - 1)), false)}
        />
        <View style={styles.row}>
          <Text style={styles.counter}>{t.pageOf(page + 1, pages.length)}</Text>
          <View style={styles.buttons}>
            {landscape && <ChromeButton label={t.twoPages} active={dual} onPress={() => setDual(!dual)} />}
            <ChromeButton label={t.mangaMode} active={rtl} onPress={toggleRtl} />
          </View>
        </View>
      </ReaderChrome>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  spread: { flex: 1 },
  page: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#fff', fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: 8 },
});
