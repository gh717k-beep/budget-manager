import { StyleSheet } from 'react-native';
import { Palette } from '@/constants/colors';

export const appStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 110 },
  eyebrow: { color: Palette.sageDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Palette.ink, fontSize: 28, fontWeight: '800' },
  sectionTitle: { color: Palette.ink, fontSize: 18, fontWeight: '800' },
  muted: { color: Palette.muted, fontSize: 13 },
  card: { backgroundColor: Palette.paper, borderRadius: 22, borderWidth: 1, borderColor: Palette.line },
});
