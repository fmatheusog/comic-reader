import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n/pt';

type Props = {
  visible: boolean;
  title: string;
  onBack: () => void;
  /** conteúdo da barra inferior */
  children?: ReactNode;
};

const BAR = 'rgba(20,20,24,0.92)';

/** Barras superior e inferior do leitor, mostradas/ocultadas com o toque no centro. */
export function ReaderChrome({ visible, title, onBack, children }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <>
      <View
        style={[
          styles.top,
          { paddingTop: insets.top + 8, paddingLeft: insets.left + 8, paddingRight: insets.right + 8 },
        ]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t.back}
          hitSlop={8}
          style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children ? (
        <View
          style={[
            styles.bottom,
            { paddingBottom: insets.bottom + 10, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
          ]}>
          {children}
        </View>
      ) : null}
    </>
  );
}

export function ChromeButton({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chromeBtn, active && styles.chromeBtnActive]}>
      <Text style={styles.chromeBtnText}>{label}</Text>
    </Pressable>
  );
}

/** Barra de progresso tocável. `reversed` espelha para leitura da direita para a esquerda. */
export function SeekBar({
  value,
  reversed,
  onSeek,
}: {
  value: number;
  reversed?: boolean;
  onSeek: (fraction: number) => void;
}) {
  const [width, setWidth] = useState(1);
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={t.progress}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width || 1)}
      onPress={(e) => {
        const f = Math.min(1, Math.max(0, e.nativeEvent.locationX / width));
        onSeek(reversed ? 1 - f : f);
      }}
      style={styles.seek}>
      <View style={styles.seekTrack} pointerEvents="none">
        <View
          style={[
            styles.seekFill,
            { width: `${value * 100}%`, alignSelf: reversed ? 'flex-end' : 'flex-start' },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: BAR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 36, lineHeight: 40 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: BAR, paddingTop: 10 },
  chromeBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chromeBtnActive: { backgroundColor: 'rgba(138,180,248,0.45)' },
  chromeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  seek: { height: 36, justifyContent: 'center' },
  seekTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  seekFill: { height: 4, backgroundColor: '#8AB4F8' },
});
