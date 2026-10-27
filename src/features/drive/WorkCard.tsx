import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveUri } from '@/entities/book/storage';
import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

import type { Work } from './model';

type Props = {
  work: Work;
  width: number;
  done: number;
  /** Capa de um capítulo já importado, se houver */
  coverPath?: string;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

// cor estável por obra, para o cartão sem capa não ficar tudo igual
const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function WorkCard({ work, width, done, coverPath, selected, onPress, onLongPress }: Props) {
  const theme = useAppTheme();
  const height = Math.round(width * 1.45);
  const total = work.files.length;
  const complete = done === total;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${work.name}, ${t.drive.importedOf(done, total)}`}
      accessibilityHint="Toque para ver os capítulos. Toque e segure para selecionar."
      style={{ width }}>
      <View
        style={[
          styles.cover,
          { width, height, borderColor: selected ? theme.accent : theme.border, borderWidth: selected ? 3 : StyleSheet.hairlineWidth },
        ]}>
        {coverPath ? (
          <Image source={{ uri: resolveUri(coverPath) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: `hsl(${hue(work.name)}, 35%, 28%)` }]}>
            <Text style={styles.placeholderText} numberOfLines={5}>
              {work.name}
            </Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: complete ? theme.accent : theme.background }]}>
          <Text style={[styles.badgeText, { color: complete ? theme.background : theme.text }]}>
            {complete ? '✓' : total}
          </Text>
        </View>
        {selected && (
          <View style={[styles.tick, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.background, fontWeight: '700' }}>✓</Text>
          </View>
        )}
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
        {work.name}
      </Text>
      <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
        {t.drive.importedOf(done, total)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 8, overflow: 'hidden' },
  placeholder: { flex: 1, padding: 10, justifyContent: 'center' },
  placeholderText: { fontSize: 14, fontWeight: '700', textAlign: 'center', color: '#fff' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 11, alignItems: 'center', opacity: 0.95 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tick: { position: 'absolute', left: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 12 },
});
