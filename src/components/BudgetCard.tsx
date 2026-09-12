import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';
import { formatCurrency } from '@/utils/calculator';
import { ProgressBar } from './ProgressBar';

interface BudgetCardProps { target: number; spent: number; dailySpent: number; dailyBudget: number; displayMode?: 'remaining' | 'daily'; onPress?: () => void; }

export function BudgetCard({ target, spent, dailySpent, dailyBudget, displayMode = 'remaining', onPress }: BudgetCardProps) {
  const ratio = target > 0 ? spent / target : 0;
  const dailyRatio = dailyBudget > 0 ? dailySpent / dailyBudget : 0;
  const displayRatio = displayMode === 'daily' ? dailyRatio : ratio;
  const footerRatio = displayMode === 'daily' ? ratio : dailyRatio;
  const remaining = Math.max(target - spent, 0);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>이번 달 생활비</Text>
          {displayMode === 'daily' ? <View style={styles.dailyAmountRow}><Text style={styles.amount}>{formatCurrency(dailySpent)}</Text><Text style={styles.amountDivider}> / </Text><Text style={styles.targetAmount}>{formatCurrency(dailyBudget)}</Text></View> : <View style={styles.amountRow}><Text style={styles.amount}>{formatCurrency(remaining)}</Text><Text style={styles.amountDivider}> / </Text><Text style={styles.targetAmount}>{formatCurrency(target)}</Text></View>}
        </View>
        <Text style={styles.percent}>{Math.round(displayRatio * 100)}%</Text>
      </View>
      <ProgressBar ratio={displayRatio} />
      <View style={styles.footer}>
        {displayMode === 'daily' ? <Text style={styles.caption}>{`${formatCurrency(remaining)} / ${formatCurrency(target)} (${Math.round(footerRatio * 100)}%)`}</Text> : <View style={styles.footerDaily}><Text style={styles.caption}>{formatCurrency(dailySpent)} / {formatCurrency(dailyBudget)} ({Math.round(footerRatio * 100)}%)</Text></View>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Palette.sageDark, borderRadius: 24, padding: 22, gap: 17, shadowColor: Palette.ink, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { color: Palette.blueSoft, fontSize: 13, fontWeight: '700' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  dailyAmountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  footerDaily: { flexDirection: 'row', alignItems: 'baseline' },
  amount: { color: Palette.white, fontSize: 29, fontWeight: '800' },
  amountDivider: { color: Palette.blueSoft, fontSize: 17, fontWeight: '600' },
  targetAmount: { color: Palette.blueSoft, fontSize: 18, fontWeight: '600' },
  dailySuffix: { color: Palette.blueSoft, fontSize: 13, fontWeight: '600', marginLeft: 2 },
  percent: { color: Palette.sage, fontSize: 27, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  caption: { color: Palette.blueSoft, fontSize: 12 },
});
