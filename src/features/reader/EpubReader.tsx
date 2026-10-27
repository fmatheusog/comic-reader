import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView as BaseWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import type { Book } from '@/entities/book/db';
import { loadEpub, readChapter, spineIndexOf, type EpubBook } from '@/entities/book/formats/epub';
import { buildChapterHtml, readerCss } from '@/entities/book/formats/epubHtml';
import { dirOf, resolveHref } from '@/entities/book/formats/epubParse';
import { locate, overallProgress } from '@/entities/book/formats/epubProgress';
import { parsePosition, useSaveProgress } from '@/features/reader/useSaveProgress';
import { t } from '@/shared/i18n/pt';
import { ReadingSettingsSheet } from '@/shared/settings/ReadingSettingsSheet';
import { useSettings } from '@/shared/settings/store';
import { useAppTheme } from '@/shared/theme';

import { EndOfChapter } from './EndOfChapter';
import { ChromeButton, ReaderChrome, SeekBar } from './ReaderChrome';

// os tipos do react-native-webview 14 não declaram o ref que o componente aceita em runtime
type WebViewHandle = { injectJavaScript: (script: string) => void };
const WebView = BaseWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

type Pos = { chapter: number; ratio: number };
type Source = { html: string; baseUrl: string; key: string };

const HISTORY_LIMIT = 20;

export function EpubReader({ book }: { book: Book }) {
  useKeepAwake();
  const theme = useAppTheme();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const web = useRef<WebViewHandle>(null);

  const [epub, setEpub] = useState<EpubBook | null>(null);
  const [error, setError] = useState(false);
  const [chapterError, setChapterError] = useState(false);
  const saved = parsePosition<Pos>(book.position);
  const [pos, setPos] = useState<Pos>({ chapter: saved?.chapter ?? 0, ratio: saved?.ratio ?? 0 });
  const [source, setSource] = useState<Source | null>(null);
  const [ready, setReady] = useState(false);
  const [controls, setControls] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  // de onde você veio ao seguir um link ou pular pelo sumário/barra
  const [history, setHistory] = useState<Pos[]>([]);

  // margem do topo estável: a barra de status some e volta, e o texto não deve pular junto
  const [topPad, setTopPad] = useState(0);
  if (insets.top > topPad) setTopPad(insets.top);

  // posição a restaurar quando o capítulo carregar (não muda a cada rolagem)
  const pendingRestore = useRef<{ ratio: number; anchor?: string }>({ ratio: saved?.ratio ?? 0 });
  const latest = useRef({ settings, theme, pos });
  useEffect(() => {
    latest.current = { settings, theme, pos };
  });
  // só a abertura mais recente vale: trocar de capítulo rápido não deixa um antigo sobrescrever o novo
  const request = useRef(0);

  const total = epub?.pkg.spine.length ?? 0;
  const progress = epub ? overallProgress(epub.sizes, pos.chapter, pos.ratio) : 0;
  useSaveProgress(book.id, progress, pos, !!epub && ready);

  const openChapterIn = useCallback(
    async (eb: EpubBook, index: number, ratio = 0, anchor?: string) => {
      const id = ++request.current;
      const i = Math.min(Math.max(index, 0), eb.pkg.spine.length - 1);
      setReady(false);
      setChapterError(false);
      pendingRestore.current = { ratio, anchor };
      setPos({ chapter: i, ratio });
      try {
        const c = await readChapter(book.id, eb, i);
        if (id !== request.current) return;
        const css = readerCss(latest.current.settings, latest.current.theme);
        setSource({ html: buildChapterHtml(c, css), baseUrl: c.baseUrl, key: `${i}-${Date.now()}` });
      } catch {
        if (id !== request.current) return;
        // um capítulo ruim não derruba o livro: avisa e deixa os controles à mão para seguir
        setSource(null);
        setChapterError(true);
        setReady(true);
        setControls(true);
      }
    },
    [book.id],
  );

  const openChapter = (index: number, ratio = 0, anchor?: string) => {
    if (epub) openChapterIn(epub, index, ratio, anchor);
  };

  /** Abre outro ponto do livro guardando o lugar atual para o botão Voltar. */
  const jump = (index: number, ratio = 0, anchor?: string) => {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), latest.current.pos]);
    openChapter(index, ratio, anchor);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    openChapter(prev.chapter, prev.ratio);
  };

  useEffect(() => {
    const start = parsePosition<Pos>(book.position);
    loadEpub(book.id)
      .then((eb) => {
        setEpub(eb);
        return openChapterIn(eb, start?.chapter ?? 0, start?.ratio ?? 0);
      })
      .catch(() => setError(true));
  }, [book.id, book.position, openChapterIn]);

  // aplica tema/fonte sem recarregar o capítulo
  useEffect(() => {
    if (!source) return;
    const css = readerCss(settings, theme);
    web.current?.injectJavaScript(`window.__setCss(${JSON.stringify(css)});true;`);
  }, [settings, theme, source]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string; [k: string]: unknown };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (!epub) return;
    switch (m.type) {
      case 'ready': {
        const { ratio, anchor } = pendingRestore.current;
        web.current?.injectJavaScript(`window.__restore(${ratio}, ${JSON.stringify(anchor ?? null)});true;`);
        setTimeout(() => setReady(true), 60);
        break;
      }
      case 'scroll':
        setPos((p) => ({ ...p, ratio: m.ratio as number }));
        break;
      case 'tap':
        if (m.zone === 'center') setControls((c) => !c);
        else web.current?.injectJavaScript(`window.__page(${m.zone === 'right' ? 1 : -1});true;`);
        break;
      case 'edge':
        if (m.dir === 1 && pos.chapter < total - 1) openChapter(pos.chapter + 1, 0);
        else if (m.dir === 1) setShowEnd(true);
        if (m.dir === -1 && pos.chapter > 0) openChapter(pos.chapter - 1, 1);
        break;
      case 'link': {
        const href = String(m.href);
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) break; // sem links externos: o app é offline
        const target = href.startsWith('#')
          ? epub.pkg.spine[pos.chapter] + href
          : resolveHref(dirOf(epub.pkg.spine[pos.chapter]), href);
        const idx = spineIndexOf(epub, target);
        if (idx >= 0) jump(idx, 0, target.includes('#') ? target.split('#')[1] : undefined);
        break;
      }
    }
  };

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{t.loadError}</Text>
      </View>
    );
  }

  const chapterTitle =
    epub?.toc.find((e) => spineIndexOf(epub, e.href) === pos.chapter)?.title ?? t.chapter(pos.chapter + 1);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar hidden={!controls} style={theme.statusBar} />
      {source && (
        <WebView
          key={source.key}
          ref={web}
          style={[styles.web, { opacity: ready ? 1 : 0, backgroundColor: theme.background, marginTop: topPad }]}
          source={{ html: source.html, baseUrl: source.baseUrl }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          setSupportMultipleWindows={false}
          mixedContentMode="never"
          overScrollMode="never"
          cacheEnabled={false}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(r) => r.url.startsWith(source.baseUrl) || r.url === 'about:blank'}
        />
      )}
      {!ready && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={theme.accent} />
        </View>
      )}
      {chapterError && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Text style={{ color: theme.text }}>{t.chapterError}</Text>
        </View>
      )}
      {showEnd && (
        <View style={StyleSheet.absoluteFill}>
          <EndOfChapter book={book} onStay={() => setShowEnd(false)} />
        </View>
      )}
      <ReaderChrome visible={controls && !showEnd} title={`${book.title} · ${chapterTitle}`} onBack={() => router.back()}>
        <SeekBar
          value={progress}
          onSeek={(f) => {
            if (!epub) return;
            const target = locate(epub.sizes, f);
            jump(target.chapter, target.ratio);
          }}
        />
        <View style={styles.row}>
          <ChromeButton label="‹" onPress={() => openChapter(pos.chapter - 1)} />
          <Text style={styles.counter} accessibilityLabel={`${t.chapter(pos.chapter + 1)} / ${total}`}>
            {pos.chapter + 1} / {total}
          </Text>
          <ChromeButton label="›" onPress={() => openChapter(pos.chapter + 1)} />
          <Text style={styles.percent} accessibilityLabel={t.progress}>
            {Math.round(progress * 100)}%
          </Text>
          {history.length > 0 && <ChromeButton label={t.backToPrev} onPress={goBack} />}
          <View style={{ flex: 1 }} />
          <ChromeButton label={t.toc} onPress={() => setShowToc(true)} />
          <ChromeButton label={t.textSettings} onPress={() => setShowSettings(true)} />
        </View>
      </ReaderChrome>

      <TocModal
        visible={showToc}
        epub={epub}
        current={pos.chapter}
        onClose={() => setShowToc(false)}
        onPick={(href) => {
          setShowToc(false);
          setControls(false);
          if (epub) {
            const idx = spineIndexOf(epub, href);
            if (idx >= 0) jump(idx, 0, href.includes('#') ? href.split('#')[1] : undefined);
          }
        }}
      />
      <ReadingSettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}

function TocModal({
  visible,
  epub,
  current,
  onClose,
  onPick,
}: {
  visible: boolean;
  epub: EpubBook | null;
  current: number;
  onClose: () => void;
  onPick: (href: string) => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const entries =
    epub && epub.toc.length > 0
      ? epub.toc
      : (epub?.pkg.spine ?? []).map((href, i) => ({ title: t.chapter(i + 1), href, depth: 0 }));
  // várias entradas podem apontar para o mesmo arquivo (âncoras); destaca só a primeira
  const activeIndex = epub ? entries.findIndex((e) => spineIndexOf(epub, e.href) === current) : -1;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top + 8 }}>
        <View style={styles.tocHeader}>
          <Text style={[styles.tocTitle, { color: theme.text }]} accessibilityRole="header">
            {t.toc}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.tocClose}>
            <Text style={{ color: theme.accent, fontWeight: '700' }}>{t.close}</Text>
          </Pressable>
        </View>
        <FlatList
          data={entries}
          keyExtractor={(e, i) => `${i}-${e.href}`}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          renderItem={({ item, index }) => {
            const active = index === activeIndex;
            return (
              <Pressable
                onPress={() => onPick(item.href)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.tocItem, { paddingLeft: 20 + item.depth * 18, borderColor: theme.border }]}>
                <Text style={{ color: active ? theme.accent : theme.text, fontWeight: active ? '700' : '400', fontSize: 16 }}>
                  {item.title}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  counter: { color: '#fff', fontVariant: ['tabular-nums'], minWidth: 56, textAlign: 'center' },
  percent: { color: 'rgba(255,255,255,0.7)', fontVariant: ['tabular-nums'], fontSize: 13, minWidth: 40, textAlign: 'center' },
  tocHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  tocTitle: { fontSize: 22, fontWeight: '700' },
  tocClose: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  tocItem: { minHeight: 48, justifyContent: 'center', paddingRight: 20, borderBottomWidth: StyleSheet.hairlineWidth },
});
