import { Text, View, StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';
import { formatMonth } from '@/utils/dateUtils';

interface MonthHeaderProps { yearMonth: string; light?: boolean; }

export function MonthHeader({ yearMonth, light = false }: MonthHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.month, light && styles.lightText]}>{formatMonth(yearMonth)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  month: { color: Palette.ink, fontSize: 26, fontWeight: '900' },
  lightText: { color: Palette.white },
});
