import { View, StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';

interface ProgressBarProps { ratio: number; }

export function ProgressBar({ ratio }: ProgressBarProps) {
  const color = ratio <= 0.5 ? Palette.progressSafe : ratio <= 0.8 ? Palette.progressWarning : Palette.progressDanger;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 12, backgroundColor: Palette.mint, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
});
