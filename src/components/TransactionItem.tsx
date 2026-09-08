import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';
import { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/calculator';

interface TransactionItemProps { transaction: Transaction; onEdit: () => void; onDelete: () => void; }

export function TransactionItem({ transaction, onEdit, onDelete }: TransactionItemProps) {
  const isIncome = transaction.type === 'INCOME';
  return (
    <Pressable onPress={onEdit} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: isIncome ? Palette.blueSoft : Palette.coralSoft }]}>
        <Text style={{ color: isIncome ? Palette.blue : Palette.coral, fontSize: 18 }}>{isIncome ? '+' : '-'}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.category}>{transaction.categoryTag}</Text>
        <Text style={styles.note}>{transaction.note || '메모 없음'}</Text>
      </View>
      <View style={styles.moneyBox}>
        <Text style={[styles.money, { color: isIncome ? Palette.blue : Palette.ink }]}>{isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}</Text>
        <Text onPress={onDelete} style={styles.delete}>삭제</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Palette.line },
  pressed: { opacity: 0.65 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, marginLeft: 12 },
  category: { color: Palette.ink, fontSize: 15, fontWeight: '800' },
  note: { color: Palette.muted, fontSize: 12, marginTop: 3 },
  moneyBox: { alignItems: 'flex-end', gap: 3 },
  money: { fontSize: 14, fontWeight: '800' },
  delete: { color: Palette.coral, fontSize: 11, fontWeight: '700' },
});
