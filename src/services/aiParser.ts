import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';
import type { NotificationLogRecord } from '@/services/notificationListener';

export type AiPaymentType = 'EXPENSE' | 'INCOME' | 'IGNORE';
export type AiTransactionKind = 'PAYMENT' | 'PERSONAL_TRANSFER' | 'IGNORE';

export interface AiPaymentResult {
  isPayment: boolean;
  amount: number;
  type: AiPaymentType;
  transactionKind: AiTransactionKind;
  place: string;
  categoryTag: string;
}

export interface AiClassificationRecord {
  result: AiPaymentResult;
  source: 'ai' | 'fallback';
}

const geminiApiKeyStorageKey = 'project1.gemini.api-key';
const aiClassificationsStorageKey = 'project1.notification-ai-classifications';
const manualTagsStorageKey = 'project1.notification-manual-tags';
let cachedApiKey: string | null | undefined;
let aiRetryAfter = 0;
let quotaWarningShown = false;
const modelName = 'gemini-3.6-flash';

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    isPayment: { type: SchemaType.BOOLEAN },
    amount: { type: SchemaType.NUMBER },
    type: { type: SchemaType.STRING, format: 'enum', enum: ['EXPENSE', 'INCOME', 'IGNORE'] },
    transactionKind: { type: SchemaType.STRING, format: 'enum', enum: ['PAYMENT', 'PERSONAL_TRANSFER', 'IGNORE'] },
    place: { type: SchemaType.STRING },
    categoryTag: { type: SchemaType.STRING, format: 'enum', enum: ['식비', '교통비', '문화생활', '쇼핑', '구독', '의료비', '생활', '주거', '급여', '개인간 송금', '기타'] },
  },
  required: ['isPayment', 'amount', 'type', 'transactionKind', 'place', 'categoryTag'],
};

const notificationLogModule = NativeModules.NotificationLogModule as {
  setBackgroundAiApiKey?: (apiKey: string) => Promise<void>;
} | undefined;

export async function parsePaymentWithAI(log: NotificationLogRecord): Promise<AiPaymentResult | null> {
  if (Date.now() < aiRetryAfter) return null;
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0,
      },
    });
    const result = await model.generateContent([
      '다음 Android 알림을 분석해 결제인지 개인 간 송금인지 구분하고 금액, 수입/지출, 상호명, 카테고리를 추출하세요.',
      'transactionKind 판단 규칙: 카드/현금 결제 또는 법인/사업자/가맹점으로의 출금은 PAYMENT, 개인에게 보내거나 개인에게 받은 송금은 PERSONAL_TRANSFER, 금융과 무관한 일반 알림/광고/잔액 부족 알림은 IGNORE입니다.',
      '상호명(place)은 알림에서 실제 상호명, 법인명, 가맹점명 또는 송금 상대방 이름을 정제해 반환하세요. (주), 주식회사 같은 법인 표기는 유지해도 됩니다.',
      '지출 categoryTag는 place의 실제 업종이나 사업 분야를 추론해 지정하세요. 예: 원미에프앤 같은 외식/식품 업체는 식비, 우아한형제들/배달 서비스는 식비, 카카오T/티머니는 교통비입니다.',
      'categoryTag는 반드시 식비, 교통비, 문화생활, 쇼핑, 구독, 의료비, 생활, 주거, 급여, 개인간 송금, 기타 중 하나를 사용하세요. 급여 입금은 급여, 개인 간 송금은 개인간 송금으로 분류하세요.',
      '금액(amount)은 원 단위를 제외한 숫자만 반환하세요.',
      '결제가 아니거나 잔액 부족/광고/일반 알림이면 isPayment=false, type=IGNORE, transactionKind=IGNORE, amount=0으로 반환하세요.',
      JSON.stringify({ title: log.title, text: log.text, appName: log.appName }),
    ]);
    const parsed = JSON.parse(result.response.text()) as Partial<AiPaymentResult>;
    if (typeof parsed.isPayment !== 'boolean') return null;
    if (!['EXPENSE', 'INCOME', 'IGNORE'].includes(parsed.type ?? '')) return null;
    if (!['PAYMENT', 'PERSONAL_TRANSFER', 'IGNORE'].includes(parsed.transactionKind ?? '')) return null;
    if (typeof parsed.amount !== 'number' || parsed.amount < 0) return null;
    if (typeof parsed.place !== 'string' || typeof parsed.categoryTag !== 'string') return null;
    return {
      isPayment: parsed.isPayment,
      amount: parsed.amount,
      type: parsed.type as AiPaymentType,
      transactionKind: parsed.transactionKind as AiTransactionKind,
      place: parsed.place,
      categoryTag: parsed.categoryTag,
    };
  } catch (error) {
    const message = String(error);
    if (message.includes('429') || message.toLowerCase().includes('quota')) {
      aiRetryAfter = Date.now() + 40_000;
      if (!quotaWarningShown) {
        console.warn('Gemini quota exceeded. Retrying after the free-tier cooldown.');
        quotaWarningShown = true;
      }
    } else {
      console.warn('Gemini payment parsing failed:', error);
    }
    return null;
  }
}

export function getAiRetryAfterSeconds(): number {
  return Math.max(Math.ceil((aiRetryAfter - Date.now()) / 1000), 0);
}

export async function getGeminiApiKey(): Promise<string | null> {
  if (cachedApiKey !== undefined) return cachedApiKey;
  cachedApiKey = await SecureStore.getItemAsync(geminiApiKeyStorageKey) || process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
  if (cachedApiKey) void notificationLogModule?.setBackgroundAiApiKey?.(cachedApiKey);
  return cachedApiKey;
}

export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const normalizedKey = apiKey.trim();
  if (normalizedKey) {
    await SecureStore.setItemAsync(geminiApiKeyStorageKey, normalizedKey);
    cachedApiKey = normalizedKey;
    await notificationLogModule?.setBackgroundAiApiKey?.(normalizedKey);
  } else {
    await SecureStore.deleteItemAsync(geminiApiKeyStorageKey);
    cachedApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
    await notificationLogModule?.setBackgroundAiApiKey?.(cachedApiKey || '');
  }
}

export async function readAiClassifications(): Promise<Record<string, AiClassificationRecord>> {
  try {
    const raw = await AsyncStorage.getItem(aiClassificationsStorageKey);
    return raw ? JSON.parse(raw) as Record<string, AiClassificationRecord> : {};
  } catch {
    return {};
  }
}

export async function saveAiClassifications(classifications: Record<string, AiClassificationRecord>): Promise<void> {
  await AsyncStorage.setItem(aiClassificationsStorageKey, JSON.stringify(classifications));
}

export function normalizeNotificationMemo(log: Pick<NotificationLogRecord, 'title' | 'text'>): string {
  return `${log.title} ${log.text}`
    .replace(/[\d][\d,]*\s*원?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

export async function readManualTags(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(manualTagsStorageKey);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch {
    return {};
  }
}

export async function saveManualTag(memoKey: string, categoryTag: string): Promise<void> {
  const tags = await readManualTags();
  tags[memoKey] = categoryTag;
  await AsyncStorage.setItem(manualTagsStorageKey, JSON.stringify(tags));
}
