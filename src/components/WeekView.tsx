import { useMemo } from 'react'
import { Shift, Staff } from '../types'
import { WEEKDAYS, addDays, minToStr, startOfWeek, toDateStr } from '../util'
import { shiftColor } from '../presets'

interface Props {
  cursor: Date
  shifts: Shift[]
  staffById: Map<string, Staff>
  onSelectDate: (date: string) => void
  onEditShift: (shift: Shift) => void
}

const PX_PER_MIN = 44 / 60 // 1시간 = 44px

interface Placement {
  shift: Shift
  lane: number
}

function layoutDay(dayShifts: Shift[]): { placements: Placement[]; laneCount: number } {
  const sorted = [...dayShifts].sort((a, b) => a.start_min - b.start_min)
  const laneEnds: number[] = []
  const placements = sorted.map(shift => {
    let lane = laneEnds.findIndex(end => end <= shift.start_min)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = shift.end_min
    return { shift, lane }
  })
  return { placements, laneCount: Math.max(1, laneEnds.length) }
}

export default function WeekView({ cursor, shifts, staffById, onSelectDate, onEditShift }: Props) {
  const todayStr = toDateStr(new Date())
  const days = useMemo(() => {
    const start = startOfWeek(cursor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [cursor])

  const dayStrs = days.map(toDateStr)
  const weekShifts = shifts.filter(s => dayStrs.includes(s.date))

  // 기본 10:00~24:00, 범위 밖 일정이 있으면 확장
  const rangeStart = Math.min(10 * 60, ...weekShifts.map(s => s.start_min))
  const rangeEnd = Math.max(24 * 60, ...weekShifts.map(s => s.end_min))
  const bodyHeight = (rangeEnd - rangeStart) * PX_PER_MIN

  const hourMarks: number[] = []
  for (let m = Math.ceil(rangeStart / 60) * 60; m <= rangeEnd; m += 60) hourMarks.push(m)

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="week-gutter" />
        {days.map(d => {
          const ds = toDateStr(d)
          return (
            <button
              key={ds}
              className={`week-day-head ${ds === todayStr ? 'today' : ''}`}
              onClick={() => onSelectDate(ds)}
            >
              <span
                className={`wd ${d.getDay() === 0 ? 'sun' : ''} ${d.getDay() === 6 ? 'sat' : ''}`}
              >
                {WEEKDAYS[d.getDay()]}
              </span>
              <span className="week-day-num">{d.getDate()}</span>
            </button>
          )
        })}
      </div>
      <div className="week-body" style={{ height: bodyHeight }}>
        <div className="week-gutter">
          {hourMarks.map(m => (
            <div key={m} className="hour-label" style={{ top: (m - rangeStart) * PX_PER_MIN }}>
              {Math.floor(m / 60)}
            </div>
          ))}
        </div>
        {days.map(d => {
          const ds = toDateStr(d)
          const { placements, laneCount } = layoutDay(weekShifts.filter(s => s.date === ds))
          return (
            <div key={ds} className="week-col" onClick={() => onSelectDate(ds)}>
              {hourMarks.map(m => (
                <div
                  key={m}
                  className="hour-line"
                  style={{ top: (m - rangeStart) * PX_PER_MIN }}
                />
              ))}
              {placements.map(({ shift, lane }) => {
                const st = staffById.get(shift.staff_id)
                const col = shiftColor(shift.date, shift.start_min, shift.end_min)
                const width = 100 / laneCount
                return (
                  <button
                    key={shift.id}
                    className="week-block"
                    style={{
                      top: (shift.start_min - rangeStart) * PX_PER_MIN,
                      height: Math.max(20, (shift.end_min - shift.start_min) * PX_PER_MIN - 2),
                      left: `${lane * width}%`,
                      width: `calc(${width}% - 2px)`,
                      background: col.bg,
                      color: col.text,
                    }}
                    onClick={e => {
                      e.stopPropagation()
                      onEditShift(shift)
                    }}
                  >
                    <span className="block-name">{st?.name ?? '?'}</span>
                    <span className="block-time">
                      {minToStr(shift.start_min)}~{minToStr(shift.end_min)}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
