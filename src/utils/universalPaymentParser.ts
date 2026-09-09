import { ParsedNotificationTransaction } from '@/types/installedApp';

const amountPattern = /([\d,]+)\s*원/;
const excludedKeywords = ['결제거부', '승인거부', '잔액부족'];
const incomeKeywords = ['입금', '취소'];
const expenseKeywords = ['결제', '출금'];

export interface NotificationPaymentSummary {
  label: '입금' | '결제' | '출금' | '취소';
  amount?: number;
}

export function getNotificationPaymentSummary(title?: string, text?: string): NotificationPaymentSummary | null {
  const sourceText = [title, text].filter(Boolean).join(' ');
  const label = sourceText.includes('입금') ? '입금'
    : sourceText.includes('취소') ? '취소'
      : sourceText.includes('출금') ? '출금'
        : sourceText.includes('결제') ? '결제' : null;
  if (!label) return null;
  const amountMatch = sourceText.match(amountPattern);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : undefined;
  return { label, amount: amount && Number.isFinite(amount) ? amount : undefined };
}

function findMerchant(text: string, amountMatch: RegExpMatchArray): string {
  const withoutAmount = text.replace(amountMatch[0], '');
  const lines = withoutAmount.split(/[\n|·]/).map((line) => line.trim()).filter(Boolean);
  const candidate = lines.find((line) => (
    !/(입금|출금|결제|취소|거부|잔액|승인|원|\d{2,4}[-./]\d{1,2}[-./]\d{1,2})/.test(line)
  ));
  if (candidate) return candidate.replace(/[()[\]]/g, '').trim();
  const residual = withoutAmount
    .replace(/입금|출금|결제|취소|결제거부|승인거부|잔액부족|승인/g, '')
    .replace(/\d{2,4}[-./]\d{1,2}[-./]\d{1,2}/g, '')
    .replace(/[()[\]]/g, '').trim();
  return residual || '알림 거래';
}

export function parsePaymentNotification(input: {
  id: string;
  packageName: string;
  appName: string;
  title?: string;
  text?: string;
  postedAt?: number;
}): ParsedNotificationTransaction | null {
  const sourceText = [input.title, input.text].filter(Boolean).join(' ').trim();
  if (!sourceText || excludedKeywords.some((keyword) => sourceText.includes(keyword))) return null;

  const amountMatch = sourceText.match(amountPattern);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const type = incomeKeywords.some((keyword) => sourceText.includes(keyword))
    ? 'INCOME'
    : expenseKeywords.some((keyword) => sourceText.includes(keyword)) ? 'EXPENSE' : null;
  if (!type) return null;

  const date = new Date(input.postedAt ?? Date.now());
  const dateString = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'))
    .join('-');
  return {
    id: input.id,
    date: dateString,
    type,
    amount,
    merchant: findMerchant(sourceText, amountMatch),
    packageName: input.packageName,
    appName: input.appName,
    sourceText,
  };
}