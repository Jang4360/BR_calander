import { fromDateStr, minToStr } from './util'

export type PresetKey = 'open' | 'middle' | 'close'

export const PRESET_NAMES: Record<PresetKey, string> = {
  open: '오픈',
  middle: '미들',
  close: '마감',
}

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

// 일정이 프리셋 시간과 정확히 일치하면 해당 프리셋 이름 반환
export function matchPreset(dateStr: string, start: number, end: number): PresetKey | null {
  for (const key of ['open', 'middle', 'close'] as PresetKey[]) {
    const t = presetTimes(key, dateStr)
    if (t.start === start && t.end === end) return key
  }
  return null
}
