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

// 월요일을 그 주의 시작으로 보는 버전 (일요일은 전 주의 7일째로 취급)
export function startOfWeekMonday(d: Date): Date {
  const offset = (d.getDay() + 6) % 7
  return addDays(d, -offset)
}

// "10월 1주"처럼 월요일이 속한 달과, 그 달 안에서 몇 번째 월요일 주인지 반환
export function weekLabel(mondayDate: Date): string {
  const month = mondayDate.getMonth()
  const year = mondayDate.getFullYear()
  let n = 0
  for (let d = 1; d <= mondayDate.getDate(); d++) {
    const cand = new Date(year, month, d)
    if (cand.getDay() === 1) n++
  }
  return `${month + 1}월 ${n}주`
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
