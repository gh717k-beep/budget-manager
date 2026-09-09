import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Palette } from '@/constants/colors';
import { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/calculator';

interface TransactionItemProps { transaction: Transaction; onEdit: () => void; onDelete: () => void; }

export function TransactionItem({ transaction, onEdit, onDelete }: TransactionItemProps) {
  const isIncome = transaction.type === 'INCOME';
  const translateX = useRef(new Animated.Value(0)).current;
  const crossedDeleteThreshold = useRef(false);
  const [isPastDeleteThreshold, setIsPastDeleteThreshold] = useState(false);
  const deleteThreshold = 90;
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderGrant: () => {
      crossedDeleteThreshold.current = false;
      setIsPastDeleteThreshold(false);
      translateX.stopAnimation();
    },
    onPanResponderMove: (_, gestureState) => {
      const nextTranslateX = Math.max(Math.min(gestureState.dx, 120), -120);
      const isPastThreshold = Math.abs(nextTranslateX) >= deleteThreshold;
      translateX.setValue(nextTranslateX);
      if (isPastThreshold && !crossedDeleteThreshold.current) {
        crossedDeleteThreshold.current = true;
        setIsPastDeleteThreshold(true);
        Vibration.vibrate(12);
      } else if (!isPastThreshold) {
        crossedDeleteThreshold.current = false;
        setIsPastDeleteThreshold(false);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (Math.abs(gestureState.dx) >= deleteThreshold) {
        Animated.timing(translateX, {
          toValue: gestureState.dx > 0 ? 420 : -420,
          duration: 160,
          useNativeDriver: true,
        }).start(() => onDelete());
        return;
      }
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 90, friction: 9 }).start();
      setIsPastDeleteThreshold(false);
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 90, friction: 9 }).start();
      setIsPastDeleteThreshold(false);
    },
  }), [onDelete, translateX]);
  const leftTrashOpacity = translateX.interpolate({ inputRange: [-120, 0, 90, 120], outputRange: [0, 0, 0.35, 1], extrapolate: 'clamp' });
  const rightTrashOpacity = translateX.interpolate({ inputRange: [-120, -90, 0, 120], outputRange: [1, 0.35, 0, 0], extrapolate: 'clamp' });
  const trashBackground = isPastDeleteThreshold ? Palette.coral : Palette.coralSoft;
  return (
    <View style={styles.itemContainer}>
      <Animated.View style={[styles.deleteButton, styles.deleteLeft, { opacity: leftTrashOpacity, backgroundColor: trashBackground }]}>
        <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={20} tintColor={Palette.white} />
      </Animated.View>
      <Animated.View style={[styles.deleteButton, styles.deleteRight, { opacity: rightTrashOpacity, backgroundColor: trashBackground }]}>
        <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={20} tintColor={Palette.white} />
      </Animated.View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        <Pressable onPress={onEdit} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={[styles.icon, { backgroundColor: isIncome ? Palette.blueSoft : Palette.coralSoft }]}>
            <Text style={{ color: isIncome ? Palette.blue : Palette.coral, fontSize: 18 }}>{isIncome ? '+' : '-'}</Text>
          </View>
          <View style={styles.details}>
            <Text style={styles.category}>{transaction.categoryTag}</Text>
            <Text style={styles.note} numberOfLines={1} ellipsizeMode="tail">{transaction.note || '메모 없음'}</Text>
          </View>
          <View style={styles.moneyBox}>
            <Text style={[styles.money, { color: isIncome ? Palette.blue : Palette.ink }]}>{isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  itemContainer: { position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 48, borderBottomWidth: 1, borderBottomColor: Palette.line },
  pressed: { opacity: 0.65 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, marginLeft: 12 },
  category: { color: Palette.ink, fontSize: 15, fontWeight: '800' },
  note: { color: Palette.muted, fontSize: 12, marginTop: 3 },
  moneyBox: { alignItems: 'flex-end', gap: 3 },
  money: { fontSize: 14, fontWeight: '800' },
  deleteButton: { position: 'absolute', top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  deleteLeft: { left: 0 },
  deleteRight: { right: 0 },
});
