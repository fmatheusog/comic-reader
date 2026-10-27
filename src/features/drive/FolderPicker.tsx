import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

import { listFolder, listSharedWithMe } from './api';
import type { CatalogRoot } from './catalogStore';

type Frame = { id: string; name: string };
const SHARED = 'shared';

type Props = { account: string; onPick: (root: CatalogRoot) => void };

/** Escolha, uma vez só, da pasta do Drive que contém a sua biblioteca. Mostra só pastas. */
export function FolderPicker({ account, onPick }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [stack, setStack] = useState<Frame[]>([]);
  const [folders, setFolders] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const top = stack[stack.length - 1];

  const go = async (frames: Frame[]) => {
    setStack(frames);
    setError(null);
    const target = frames[frames.length - 1];
    if (!target) return;
    setLoading(true);
    try {
      const entries = target.id === SHARED ? await listSharedWithMe() : await listFolder(target.id);
      setFolders(entries.filter((e) => e.kind === 'folder').map((e) => ({ id: e.id, name: e.name })));
    } catch (e) {
      setFolders([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const rows: Frame[] = top
    ? folders
    : [
        { id: SHARED, name: t.drive.sharedWithMe },
        { id: 'root', name: t.drive.myDrive },
      ];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.intro}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{t.drive.pickTitle}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18 }}>{t.drive.pickBody}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>{t.drive.signedAs(account)}</Text>
      </View>

      {top && (
        <Pressable
          onPress={() => go(stack.slice(0, -1))}
          accessibilityRole="button"
          style={[styles.crumb, { borderColor: theme.border }]}>
          <Text style={{ color: theme.accent, fontWeight: '600' }}>‹ {top.name}</Text>
        </Pressable>
      )}

      <FlatList
        data={rows}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 + insets.bottom, gap: 8 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
          ) : error ? (
            <Text style={styles.error}>{t.drive.loadError} {error}</Text>
          ) : (
            <Text style={{ color: theme.textMuted, textAlign: 'center', paddingTop: 32 }}>{t.drive.noFolders}</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => go([...stack, item])}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ fontSize: 20 }}>📁</Text>
            <Text style={{ color: theme.text, fontWeight: '600', flex: 1 }} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 20 }}>›</Text>
          </Pressable>
        )}
      />

      {top && top.id !== SHARED && (
        <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
          <Text style={{ color: theme.text, flex: 1, fontWeight: '600' }} numberOfLines={1}>
            {top.name}
          </Text>
          <Pressable
            onPress={() => onPick({ id: top.id, name: top.name })}
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.background, fontWeight: '700' }}>{t.drive.usePicked}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 16, gap: 6, paddingBottom: 12 },
  crumb: { marginHorizontal: 16, minHeight: 44, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, minHeight: 56 },
  error: { color: '#D93025', textAlign: 'center', paddingTop: 32 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  primary: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
});
