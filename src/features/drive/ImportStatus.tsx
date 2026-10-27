import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/shared/i18n/pt';
import { useAppTheme } from '@/shared/theme';

type Props = {
  status: string | null;
  failedCount: number;
  onRetry: () => void;
};

/** Resultado da última importação, com o botão para tentar de novo o que falhou. */
export function ImportStatus({ status, failedCount, onRetry }: Props) {
  const theme = useAppTheme();
  if (!status && failedCount === 0) return null;
  return (
    <View style={styles.wrap}>
      {status && <Text style={{ color: theme.textMuted }}>{status}</Text>}
      {failedCount > 0 && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={[styles.retry, { borderColor: theme.accent }]}>
          <Text style={{ color: theme.accent, fontWeight: '600' }}>{t.drive.retryFailed(failedCount)}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  retry: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center' },
});
