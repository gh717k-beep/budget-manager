export const toYearMonth = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const toDateString = (date: Date) => {
  return `${toYearMonth(date)}-${String(date.getDate()).padStart(2, '0')}`;
};

export const parseYearMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

export const shiftMonth = (yearMonth: string, amount: number) => {
  const date = parseYearMonth(yearMonth);
  date.setMonth(date.getMonth() + amount);
  return toYearMonth(date);
};

export const getDaysInMonth = (yearMonth: string) => {
  const date = parseYearMonth(yearMonth);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

export const formatMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${Number(month)}월`;
};

export const getPayCycle = (yearMonth: string, payday: number) => {
  const start = parseYearMonth(yearMonth);
  start.setDate(Math.min(Math.max(payday, 1), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
  const nextStart = new Date(start.getFullYear(), start.getMonth() + 1, Math.min(Math.max(payday, 1), new Date(start.getFullYear(), start.getMonth() + 2, 0).getDate()));
  nextStart.setDate(nextStart.getDate() - 1);

  return { start: toDateString(start), end: toDateString(nextStart) };
};

export const getDatesInRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (current <= end) {
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const formatDateLabel = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]}`;
};

const fixedPublicHolidays = new Set(['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25']);
const additionalPublicHolidays: Record<string, string[]> = {
  '2026': ['02-16', '02-17', '02-18', '03-02', '08-17', '09-24', '09-25', '09-26', '10-05'],
};

export const isKoreanPublicHoliday = (dateString: string) => {
  const [year, month, day] = dateString.split('-');
  return fixedPublicHolidays.has(`${month}-${day}`) || additionalPublicHolidays[year]?.includes(`${month}-${day}`) === true;
};
