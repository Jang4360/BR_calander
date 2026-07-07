export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay())
}

export function minToStr(min: number): string {
  return `${Math.floor(min / 60)}:${pad(min % 60)}`
}

export function fmtDayTitle(dateStr: string): string {
  const d = fromDateStr(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

export function fmtMoney(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

export function fmtHours(minutes: number): string {
  const h = minutes / 60
  return Number.isInteger(h) ? `${h}시간` : `${h.toFixed(1)}시간`
}
