import { View, Text, StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';
import { formatCurrency } from '@/utils/calculator';
import { ProgressBar } from './ProgressBar';

interface BudgetCardProps { target: number; spent: number; onPress: () => void; }

export function BudgetCard({ target, spent, onPress }: BudgetCardProps) {
  const ratio = target > 0 ? spent / target : 0;
  const percent = Math.round(ratio * 100);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>이번 달 생활비</Text>
          <Text style={styles.amount}>{formatCurrency(spent)}</Text>
        </View>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <ProgressBar ratio={ratio} />
      <View style={styles.footer}>
        <Text style={styles.caption}>목표 {formatCurrency(target)}</Text>
        <Text style={styles.caption}>남은 금액 {formatCurrency(Math.max(target - spent, 0))}</Text>
      </View>
      <Text onPress={onPress} style={styles.action}>예산 설정 편집  ›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Palette.sageDark, borderRadius: 24, padding: 22, gap: 17 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { color: Palette.blueSoft, fontSize: 13, fontWeight: '700' },
  amount: { color: Palette.white, fontSize: 28, fontWeight: '800', marginTop: 7 },
  percent: { color: Palette.sage, fontSize: 27, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  caption: { color: Palette.blueSoft, fontSize: 12 },
  action: { color: Palette.sage, fontSize: 13, fontWeight: '800', marginTop: 2 },
});
