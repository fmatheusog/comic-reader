import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text }}>Leitor ({id}) — em construção</Text>
    </View>
  );
}
