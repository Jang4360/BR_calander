import { fromDateStr, minToStr } from './util'

export type PresetKey = 'open' | 'middle' | 'close'

export const PRESET_ORDER: PresetKey[] = ['open', 'middle', 'close']

export const PRESET_NAMES: Record<PresetKey, string> = {
  open: '오픈',
  middle: '미들',
  close: '마감',
}

// 시간대별 색상: 오픈 노랑, 미들 주황, 마감 빨강 (text는 배경 위 글자색)
export const PRESET_COLORS: Record<PresetKey, { bg: string; text: string }> = {
  open: { bg: '#FFC53C', text: '#5b3d00' },
  middle: { bg: '#FF7D3C', text: '#ffffff' },
  close: { bg: '#FF3C3C', text: '#ffffff' },
}

// 어떤 시간대에도 해당하지 않는 일정의 색상
export const UNCLASSIFIED_COLOR = { bg: '#8e8e93', text: '#ffffff' }

// 오픈: 월수금 10:30~14:00 / 화목토일 11:00~14:00
// 미들: 14:00~18:00, 마감: 18:00~23:00
export function presetTimes(key: PresetKey, dateStr: string): { start: number; end: number } {
  if (key === 'open') {
    const day = fromDateStr(dateStr).getDay()
    const isMWF = day === 1 || day === 3 || day === 5
    return isMWF ? { start: 10 * 60 + 30, end: 14 * 60 } : { start: 11 * 60, end: 14 * 60 }
  }
  if (key === 'middle') return { start: 14 * 60, end: 18 * 60 }
  return { start: 18 * 60, end: 23 * 60 }
}

export function presetTimeLabel(key: PresetKey, dateStr: string): string {
  const { start, end } = presetTimes(key, dateStr)
  return `${minToStr(start)}~${minToStr(end)}`
}

// 연속된 시간대 조합 (오픈+마감처럼 건너뛰는 조합은 없음)
const COMBOS: PresetKey[][] = [
  ['open'],
  ['middle'],
  ['close'],
  ['open', 'middle'],
  ['middle', 'close'],
  ['open', 'middle', 'close'],
]

function comboRange(combo: PresetKey[], dateStr: string): { start: number; end: number } {
  return {
    start: presetTimes(combo[0], dateStr).start,
    end: presetTimes(combo[combo.length - 1], dateStr).end,
  }
}

const TOLERANCE = 60 // 시작·종료 각각 1시간 오차까지 같은 시간대로 분류

// 일정을 시간대(조합)로 분류. 해당 없으면 빈 배열.
export function classifyShift(dateStr: string, start: number, end: number): PresetKey[] {
  let best: { combo: PresetKey[]; dev: number } | null = null
  for (const combo of COMBOS) {
    const r = comboRange(combo, dateStr)
    const ds = Math.abs(start - r.start)
    const de = Math.abs(end - r.end)
    if (ds <= TOLERANCE && de <= TOLERANCE) {
      const dev = ds + de
      if (!best || dev < best.dev) best = { combo, dev }
    }
  }
  return best?.combo ?? []
}

// 조합 라벨: "오픈", "오픈+미들" 등
export function comboLabel(combo: PresetKey[]): string {
  return combo.map(k => PRESET_NAMES[k]).join('+')
}

// 일정 표시 색상: 분류된 조합의 첫(가장 이른) 시간대 색상
export function shiftColor(dateStr: string, start: number, end: number): { bg: string; text: string } {
  const combo = classifyShift(dateStr, start, end)
  return combo.length ? PRESET_COLORS[combo[0]] : UNCLASSIFIED_COLOR
}
