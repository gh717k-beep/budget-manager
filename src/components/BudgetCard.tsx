import { View, Text, StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';
import { formatCurrency } from '@/utils/calculator';
import { ProgressBar } from './ProgressBar';

interface BudgetCardProps { target: number; spent: number; dailyBudget: number; onPress: () => void; }

export function BudgetCard({ target, spent, dailyBudget, onPress }: BudgetCardProps) {
  const ratio = target > 0 ? spent / target : 0;
  const percent = Math.round(ratio * 100);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>이번 달 생활비</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amount}>{Math.max(target - spent, 0).toLocaleString('ko-KR')}</Text>
            <Text style={styles.amountDivider}> / </Text>
            <Text style={styles.targetAmount}>{target.toLocaleString('ko-KR')}</Text>
          </View>
        </View>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <ProgressBar ratio={ratio} />
      <View style={styles.footer}>
        <Text style={styles.caption}>목표 {formatCurrency(target)}</Text>
        <Text style={styles.caption}>하루 사용 가능 {formatCurrency(dailyBudget)}</Text>
      </View>
      <Text onPress={onPress} style={styles.action}>예산 설정 편집  ›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Palette.sageDark, borderRadius: 24, padding: 22, gap: 17 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { color: Palette.blueSoft, fontSize: 13, fontWeight: '700' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  amount: { color: Palette.white, fontSize: 21, fontWeight: '800' },
  amountDivider: { color: Palette.blueSoft, fontSize: 17, fontWeight: '600' },
  targetAmount: { color: Palette.blueSoft, fontSize: 13, fontWeight: '600' },
  percent: { color: Palette.sage, fontSize: 27, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  caption: { color: Palette.blueSoft, fontSize: 12 },
  action: { color: Palette.sage, fontSize: 13, fontWeight: '800', marginTop: 2 },
});
