import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';
import { formatCurrency } from '@/utils/calculator';
import { ProgressBar } from './ProgressBar';

interface BudgetCardProps { target: number; spent: number; dailyBudget: number; displayMode?: 'remaining' | 'daily'; onPress?: () => void; }

export function BudgetCard({ target, spent, dailyBudget, displayMode = 'remaining', onPress }: BudgetCardProps) {
  const ratio = target > 0 ? spent / target : 0;
  const percent = Math.round(ratio * 100);
  const remaining = Math.max(target - spent, 0);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>이번 달 생활비</Text>
          {displayMode === 'daily' ? <View style={styles.dailyAmountRow}><Text style={styles.amount}>{formatCurrency(dailyBudget)}</Text><Text style={styles.dailySuffix}>/일</Text></View> : <View style={styles.amountRow}><Text style={styles.amount}>{remaining.toLocaleString('ko-KR')}</Text><Text style={styles.amountDivider}> / </Text><Text style={styles.targetAmount}>{target.toLocaleString('ko-KR')}</Text></View>}
        </View>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <ProgressBar ratio={ratio} />
      <View style={styles.footer}>
        <Text style={styles.caption}>목표 {formatCurrency(target)}</Text>
        {displayMode === 'daily' ? <Text style={styles.caption}>{`남은 금액 ${remaining.toLocaleString('ko-KR')} / 목표 ${target.toLocaleString('ko-KR')}`}</Text> : <View style={styles.footerDaily}><Text style={styles.caption}>{formatCurrency(dailyBudget)}</Text><Text style={styles.dailySuffix}>/일</Text></View>}
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
