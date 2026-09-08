import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette } from '@/constants/colors';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories';
import { useBudgetBook } from '@/hooks/useBudgetBook';
import { BudgetCard } from '@/components/BudgetCard';
import { MonthHeader } from '@/components/MonthHeader';
import { TransactionItem } from '@/components/TransactionItem';
import { MonthlyBudget } from '@/types/budget';
import { Transaction } from '@/types/transaction';
import { formatCurrency, getBudgetAmounts, sumTransactionsInRange } from '@/utils/calculator';
import { formatDateLabel, getDatesInRange, getPayCycle, shiftMonth, toDateString, toYearMonth } from '@/utils/dateUtils';
import { appStyles } from '@/styles/theme';

const today = new Date();
const initialMonth = toYearMonth(today);
const initialDate = toDateString(today);
const getPreferredDate = (yearMonth: string, payday: number) => {
  const cycle = getPayCycle(yearMonth, payday);
  const firstOfMonth = `${yearMonth}-01`;
  if (initialDate >= cycle.start && initialDate <= cycle.end) return initialDate;
  if (firstOfMonth >= cycle.start && firstOfMonth <= cycle.end) return firstOfMonth;
  return cycle.start;
};

type ModalMode = 'transaction' | 'budget' | null;

export default function DashboardScreen() {
  const { transactions, saveTransaction, removeTransaction, getBudget, saveBudget } = useBudgetBook();
  const { width } = useWindowDimensions();
  const cardTranslateX = useRef(new Animated.Value(0)).current;
  const isCardAnimating = useRef(false);
  const daysScrollRef = useRef<ScrollView>(null);
  const [yearMonth, setYearMonth] = useState(initialMonth);
  const [budget, setBudget] = useState<MonthlyBudget>(() => getBudget(initialMonth));
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selectedDate, setSelectedDate] = useState(getPreferredDate(initialMonth, budget.payday ?? 1));

  const payCycle = getPayCycle(yearMonth, budget.payday ?? 1);
  const cycleDates = useMemo(() => getDatesInRange(payCycle.start, payCycle.end), [payCycle.start, payCycle.end]);
  const monthTransactions = transactions.filter((item) => item.date >= payCycle.start && item.date <= payCycle.end);
  const dayTransactions = transactions.filter((item) => item.date === selectedDate);
  const spent = sumTransactionsInRange(transactions, 'EXPENSE', payCycle.start, payCycle.end);
  const amounts = getBudgetAmounts(budget);
  const todayString = toDateString(new Date());
  const isTodayInPayCycle = todayString >= payCycle.start && todayString <= payCycle.end;
  const budgetDays = isTodayInPayCycle
    ? getDatesInRange(todayString, payCycle.end).length
    : getDatesInRange(payCycle.start, payCycle.end).length;
  const dailyBudget = Math.max(amounts.living - spent, 0) / Math.max(budgetDays, 1);
  const days = cycleDates;

  useEffect(() => {
    const preferredDate = getPreferredDate(yearMonth, budget.payday ?? 1);
    const preferredIndex = days.indexOf(preferredDate);
    setSelectedDate(preferredDate);
    if (preferredIndex >= 0) {
      requestAnimationFrame(() => daysScrollRef.current?.scrollTo({ x: Math.max(preferredIndex * 66 - 24, 0), animated: true }));
    }
  }, [budget.payday, days, yearMonth]);

  const changeMonth = (amount: number) => {
    const nextMonth = shiftMonth(yearMonth, amount);
    const nextBudget = getBudget(nextMonth);
    setYearMonth(nextMonth);
    setSelectedDate(getPreferredDate(nextMonth, nextBudget.payday ?? 1));
    setBudget(nextBudget);
  };

  const animateMonthChange = (amount: number) => {
    if (isCardAnimating.current) return;

    const direction = amount > 0 ? -1 : 1;
    isCardAnimating.current = true;
    Animated.timing(cardTranslateX, {
      toValue: direction * width,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isCardAnimating.current = false;
        return;
      }

      changeMonth(amount);
      cardTranslateX.setValue(-direction * width);
      Animated.timing(cardTranslateX, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        isCardAnimating.current = false;
      });
    });
  };

  const cardSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderMove: (_, gestureState) => {
      if (!isCardAnimating.current) cardTranslateX.setValue(gestureState.dx);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 50) animateMonthChange(-1);
      else if (gestureState.dx < -50) animateMonthChange(1);
      else Animated.spring(cardTranslateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 9 }).start();
    },
  }), [width, yearMonth]);

  const openNewTransaction = () => {
    setEditing({ id: `${Date.now()}`, date: selectedDate, type: 'EXPENSE', amount: 0, categoryTag: EXPENSE_CATEGORIES[0], note: '' });
    setModalMode('transaction');
  };

  const openBudget = () => { setBudget(getBudget(yearMonth)); setModalMode('budget'); };
  const closeModal = () => { setModalMode(null); setEditing(null); };

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}><MonthHeader yearMonth={yearMonth} /></View>
        <Animated.View {...cardSwipeResponder.panHandlers} style={{ transform: [{ translateX: cardTranslateX }] }}>
          <BudgetCard target={amounts.living} spent={spent} dailyBudget={dailyBudget} displayMode={budget.displayMode} onPress={openBudget} />
        </Animated.View>
        <Pressable onPress={openBudget} style={[styles.summaryRow, { paddingVertical: 17 }]}>
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <Summary label="월 수입" value={budget.totalIncome} color={Palette.blue} />
            <Summary label="생활비" value={amounts.living} color={Palette.sageDark} />
            <Summary label="저금" value={amounts.savings} color={Palette.amber} />
          </View>
        </Pressable>
        <View style={styles.sectionHeader}><Text style={appStyles.sectionTitle}>날짜별 기록</Text><Text style={appStyles.muted}>{monthTransactions.length}건</Text></View>
        <ScrollView ref={daysScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
          {days.map((date) => { const active = date === selectedDate; const isToday = date === initialDate; const dateObject = new Date(`${date}T00:00:00`); const day = dateObject.getDate(); const dayOfWeek = dateObject.getDay(); const dayTransactions = transactions.filter((item) => item.date === date); const dayExpense = dayTransactions.filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0); const dayIncome = dayTransactions.filter((item) => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0); const weekendColor = dayOfWeek === 0 ? Palette.coral : dayOfWeek === 6 ? Palette.blue : Palette.ink; return <Pressable key={date} onPress={() => setSelectedDate(date)} style={[styles.day, active && styles.activeDay, isToday && { borderColor: Palette.coral, borderWidth: 2 }, { width: 58, height: 70 }]}><View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}><Text style={[{ color: Palette.muted, fontSize: 10, fontWeight: '700' }, active && styles.activeText]}>{dateObject.getMonth() + 1}.</Text><Text style={[styles.dayNumber, { color: weekendColor, fontSize: 18 }, active && styles.activeText]}>{day}</Text></View><View style={{ alignItems: 'center', marginTop: 2 }}>{dayExpense > 0 && <Text style={[{ color: Palette.coral, fontSize: 8, lineHeight: 10 }, active && styles.activeText]}>-{dayExpense.toLocaleString('ko-KR')}</Text>}{dayIncome > 0 && <Text style={[{ color: Palette.blue, fontSize: 8, lineHeight: 10 }, active && styles.activeText]}>+{dayIncome.toLocaleString('ko-KR')}</Text>}</View></Pressable>; })}
        </ScrollView>
        <View style={styles.sectionHeader}><View><Text style={appStyles.sectionTitle}>{formatDateLabel(selectedDate)}</Text><Text style={appStyles.muted}>선택한 날짜의 수입과 지출</Text></View><Pressable onPress={openNewTransaction} style={styles.smallAdd}><Text style={styles.smallAddText}>+ 기록</Text></Pressable></View>
        <View style={styles.list}>{dayTransactions.length ? dayTransactions.map((item) => <TransactionItem key={item.id} transaction={item} onEdit={() => { setEditing(item); setModalMode('transaction'); }} onDelete={() => removeTransaction(item.id)} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>아직 기록이 없어요</Text><Text style={appStyles.muted}>오늘의 소비를 한 줄 남겨보세요.</Text></View>}</View>
      </ScrollView>
      <Pressable onPress={openNewTransaction} style={styles.fab}><Text style={styles.fabText}>+</Text></Pressable>
      <Modal visible={modalMode !== null} animationType="slide" transparent onRequestClose={closeModal}><View style={styles.modalBackdrop}><View style={[styles.modal, { maxHeight: '90%' }]}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>{modalMode === 'transaction' && editing && <TransactionForm value={editing} onChange={setEditing} onSave={() => { saveTransaction(editing); closeModal(); }} onClose={closeModal} />}{modalMode === 'budget' && <BudgetForm value={budget} onChange={setBudget} onSave={() => { const normalizedBudget = { ...budget, totalIncome: Number(budget.totalIncome) || 0, allocations: { ...budget.allocations, livingExpensePercent: Number(budget.allocations.livingExpensePercent) || 0, savingsPercent: Number(budget.allocations.savingsPercent) || 0 } }; saveBudget(normalizedBudget); setSelectedDate(getPreferredDate(yearMonth, normalizedBudget.payday ?? 1)); closeModal(); }} onClose={closeModal} />}</ScrollView></KeyboardAvoidingView></View></View></Modal>
    </SafeAreaView>
  );
}

function Summary({ label, value, color }: { label: string; value: number; color: string }) { return <View style={styles.summary}><Text style={[styles.summaryLabel, { color }]}>{label}</Text><Text style={styles.summaryValue}>{formatCurrency(value)}</Text></View>; }

function Field({ label, value, onChange, keyboardType = 'default' }: { label: string; value: string; onChange: (value: string) => void; keyboardType?: 'default' | 'numeric' }) { const displayValue = label === '월 수입' && value ? Number(value.replace(/[^0-9]/g, '')).toLocaleString('ko-KR') : value; return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={displayValue} onChangeText={onChange} keyboardType={keyboardType} style={styles.input} placeholderTextColor={Palette.muted} />{label === '월 수입' && <AmountAdjustRow onAdd={(amount) => onChange(String((Number(value.replace(/[^0-9]/g, '')) || 0) + amount))} onReset={() => onChange('')} />}</View>; }

function AmountAdjustRow({ onAdd, onReset }: { onAdd: (amount: number) => void; onReset: () => void }) { return <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>{[50000, 100000, 200000].map((amount) => <Pressable key={amount} onPress={() => onAdd(amount)} style={{ flex: 1, borderWidth: 1, borderColor: Palette.line, borderRadius: 12, alignItems: 'center', paddingVertical: 9 }}><Text style={{ color: Palette.sageDark, fontSize: 12, fontWeight: '800' }}>+{amount.toLocaleString('ko-KR')}</Text></Pressable>)}<Pressable onPress={onReset} style={{ flex: 1, borderWidth: 1, borderColor: Palette.coralSoft, borderRadius: 12, alignItems: 'center', paddingVertical: 9 }}><Text style={{ color: Palette.coral, fontSize: 12, fontWeight: '800' }}>초기화</Text></Pressable></View>; }
function ChoiceRow({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) { const scrollRef = useRef<ScrollView>(null); const selectedIndex = options.indexOf(value); useEffect(() => { if (selectedIndex >= 0) requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: Math.max(selectedIndex * 48 - 120, 0), animated: false })); }, [options, selectedIndex]); return <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>{options.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={[styles.choice, value === option && styles.choiceActive]}><Text style={[styles.choiceText, value === option && styles.choiceTextActive]}>{option}</Text></Pressable>)}</ScrollView>; }

function TransactionForm({ value, onChange, onSave, onClose }: { value: Transaction; onChange: (value: Transaction) => void; onSave: () => void; onClose: () => void }) { const categories = value.type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES; return <><ModalHeader title={value.id.length > 10 ? '새 기록' : '기록 편집'} onClose={onClose} /><View style={styles.typeRow}>{(['EXPENSE', 'INCOME'] as const).map((type) => <Pressable key={type} onPress={() => onChange({ ...value, type, categoryTag: type === 'EXPENSE' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0] })} style={[styles.typeButton, value.type === type && styles.typeActive]}><Text style={[styles.typeText, value.type === type && styles.typeTextActive]}>{type === 'EXPENSE' ? '지출' : '수입'}</Text></Pressable>)}</View><Field label="금액" value={value.amount ? String(value.amount) : ''} onChange={(amount) => onChange({ ...value, amount: Number(amount.replace(/[^0-9]/g, '')) || 0 })} keyboardType="numeric" /><Field label="메모" value={value.note || ''} onChange={(note) => onChange({ ...value, note })} /><Text style={styles.fieldLabel}>카테고리</Text><ChoiceRow options={categories} value={value.categoryTag} onChange={(categoryTag) => onChange({ ...value, categoryTag })} /><Pressable onPress={onSave} style={styles.save}><Text style={styles.saveText}>기록 저장</Text></Pressable></>; }

function BudgetForm({ value, onChange, onSave, onClose }: { value: MonthlyBudget; onChange: (value: MonthlyBudget) => void; onSave: () => void; onClose: () => void }) { const update = (key: keyof MonthlyBudget['allocations'], raw: string) => onChange({ ...value, allocations: { ...value.allocations, [key]: Number(raw.replace(/[^0-9]/g, '')) || 0 } }); const paydayOptions = Array.from({ length: 30 }, (_, index) => String(index + 1)); const displayOptions = ['남은 금액 / 목표 금액', '하루 사용 가능 금액']; const displayValue = value.displayMode === 'daily' ? displayOptions[1] : displayOptions[0]; return <><ModalHeader title="예산 설정" onClose={onClose} /><Text style={styles.modalIntro}>월급일부터 다음 월급 전날까지의 지출을 관리해요.</Text><Field label="월 수입" value={value.totalIncome ? String(value.totalIncome) : ''} onChange={(totalIncome) => onChange({ ...value, totalIncome: Number(totalIncome.replace(/[^0-9]/g, '')) || 0 })} keyboardType="numeric" /><Text style={styles.fieldLabel}>월급 받는 날 · {value.payday}일</Text><ChoiceRow options={paydayOptions} value={String(Math.min(Math.max(value.payday ?? 1, 1), 30))} onChange={(payday) => onChange({ ...value, payday: Number(payday) })} /><Text style={styles.fieldLabel}>생활비 카드에 크게 표시할 금액</Text><ChoiceRow options={displayOptions} value={displayValue} onChange={(display) => onChange({ ...value, displayMode: display === displayOptions[1] ? 'daily' : 'remaining' })} /><View style={styles.percentGrid}><PercentField label="생활비" value={value.allocations.livingExpensePercent} onChange={(raw) => update('livingExpensePercent', raw)} /><PercentField label="저금" value={value.allocations.savingsPercent} onChange={(raw) => update('savingsPercent', raw)} /></View><View style={styles.allocationPreview}><Text style={styles.previewTitle}>배분 결과</Text><Text style={styles.previewValue}>{formatCurrency(value.totalIncome * value.allocations.livingExpensePercent / 100)} 생활비  ·  {formatCurrency(value.totalIncome * value.allocations.savingsPercent / 100)} 저금</Text></View><Pressable onPress={onSave} style={styles.save}><Text style={styles.saveText}>예산 저장</Text></Pressable></>; }

function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) { return <View style={styles.percentField}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.percentInput}><TextInput value={value ? String(value) : ''} onChangeText={onChange} keyboardType="numeric" style={styles.percentText} /><Text style={styles.percentMark}>%</Text></View></View>; }
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose}><Text style={styles.close}>닫기</Text></Pressable></View>; }

const styles = StyleSheet.create({ top: { marginTop: 12, marginBottom: 22, gap: 7 }, subtitle: { color: Palette.muted, fontSize: 13 }, summaryRow: { flexDirection: 'row', backgroundColor: Palette.paper, borderRadius: 20, marginTop: 14, marginBottom: 28, paddingVertical: 17, borderWidth: 1, borderColor: Palette.line }, summary: { flex: 1, paddingLeft: 16, borderRightWidth: 1, borderRightColor: Palette.line }, summaryLabel: { fontSize: 12, fontWeight: '800' }, summaryValue: { color: Palette.ink, fontSize: 13, fontWeight: '800', marginTop: 6 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, daysRow: { gap: 8, paddingBottom: 28 }, day: { width: 47, height: 63, borderRadius: 17, backgroundColor: Palette.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.line }, activeDay: { backgroundColor: Palette.sageDark, borderColor: Palette.sageDark }, dayNumber: { color: Palette.ink, fontSize: 17, fontWeight: '800' }, dayLabel: { color: Palette.muted, fontSize: 11, marginTop: 4 }, activeText: { color: Palette.white }, smallAdd: { backgroundColor: Palette.mint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }, smallAddText: { color: Palette.sageDark, fontWeight: '800', fontSize: 12 }, list: { backgroundColor: Palette.paper, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: Palette.line }, empty: { alignItems: 'center', paddingVertical: 35, gap: 7 }, emptyTitle: { color: Palette.ink, fontWeight: '800', fontSize: 15 }, fab: { position: 'absolute', right: 22, bottom: 25, width: 58, height: 58, borderRadius: 20, backgroundColor: Palette.coral, alignItems: 'center', justifyContent: 'center', elevation: 5 }, fabText: { color: Palette.white, fontSize: 31, fontWeight: '300', lineHeight: 34 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,34,27,0.38)' }, modal: { backgroundColor: Palette.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 38, gap: 15 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, modalTitle: { color: Palette.ink, fontSize: 22, fontWeight: '900' }, close: { color: Palette.muted, fontSize: 13, fontWeight: '700' }, modalIntro: { color: Palette.muted, fontSize: 13, marginTop: -6 }, typeRow: { flexDirection: 'row', gap: 8 }, typeButton: { flex: 1, paddingVertical: 12, borderRadius: 13, alignItems: 'center', backgroundColor: Palette.canvas }, typeActive: { backgroundColor: Palette.ink }, typeText: { color: Palette.muted, fontWeight: '800' }, typeTextActive: { color: Palette.white }, field: { gap: 7 }, fieldLabel: { color: Palette.ink, fontSize: 12, fontWeight: '800' }, input: { height: 48, borderWidth: 1, borderColor: Palette.line, borderRadius: 12, paddingHorizontal: 14, color: Palette.ink, fontSize: 15, backgroundColor: '#FBFCFA' }, choices: { gap: 8 }, choice: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: Palette.canvas }, choiceActive: { backgroundColor: Palette.sageDark }, choiceText: { color: Palette.muted, fontSize: 12, fontWeight: '700' }, choiceTextActive: { color: Palette.white }, save: { backgroundColor: Palette.ink, borderRadius: 14, alignItems: 'center', paddingVertical: 15, marginTop: 5 }, saveText: { color: Palette.white, fontSize: 15, fontWeight: '800' }, percentGrid: { flexDirection: 'row', gap: 9 }, percentField: { flex: 1, gap: 7 }, percentInput: { height: 48, borderWidth: 1, borderColor: Palette.line, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: '#FBFCFA' }, percentText: { flex: 1, color: Palette.ink, fontSize: 15 }, percentMark: { color: Palette.muted, fontWeight: '800' }, allocationPreview: { backgroundColor: Palette.mint, borderRadius: 14, padding: 14, gap: 5 }, previewTitle: { color: Palette.sageDark, fontSize: 12, fontWeight: '800' }, previewValue: { color: Palette.ink, fontSize: 13, fontWeight: '700' } });
