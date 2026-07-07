import { useMemo } from 'react'
import { Shift, Staff } from '../types'
import { WEEKDAYS, addDays, startOfWeek, toDateStr } from '../util'
import { shiftColor } from '../presets'

interface Props {
  cursor: Date
  shifts: Shift[]
  staffById: Map<string, Staff>
  onSelectDate: (date: string) => void
}

const MAX_CHIPS = 4

export default function MonthView({ cursor, shifts, staffById, onSelectDate }: Props) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const todayStr = toDateStr(new Date())

  const weeks = useMemo(() => {
    const first = new Date(year, month, 1)
    const gridStart = startOfWeek(first)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const weekCount = Math.ceil((first.getDay() + daysInMonth) / 7)
    const rows: Date[][] = []
    for (let w = 0; w < weekCount; w++) {
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i)))
    }
    return rows
  }, [year, month])

  const shiftsByDate = useMemo(() => {
    const m = new Map<string, Shift[]>()
    for (const s of shifts) {
      const arr = m.get(s.date) ?? []
      arr.push(s)
      m.set(s.date, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.start_min - b.start_min)
    return m
  }, [shifts])

  return (
    <div className="month-view">
      <div className="month-weekdays">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`wd ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>
            {w}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div className="month-row" key={wi}>
          {week.map(d => {
            const ds = toDateStr(d)
            const inMonth = d.getMonth() === month
            const dayShifts = shiftsByDate.get(ds) ?? []
            const cls = [
              'month-cell',
              inMonth ? '' : 'dim',
              ds === todayStr ? 'today' : '',
            ].join(' ')
            return (
              <button key={ds} className={cls} onClick={() => onSelectDate(ds)}>
                <span
                  className={`day-num ${d.getDay() === 0 ? 'sun' : ''} ${d.getDay() === 6 ? 'sat' : ''}`}
                >
                  {d.getDate()}
                </span>
                <span className="cell-chips">
                  {dayShifts.slice(0, MAX_CHIPS).map(s => {
                    const st = staffById.get(s.staff_id)
                    const col = shiftColor(s.date, s.start_min, s.end_min)
                    return (
                      <span
                        key={s.id}
                        className="cell-chip"
                        style={{ background: col.bg, color: col.text }}
                      >
                        {st?.name ?? '?'}
                      </span>
                    )
                  })}
                  {dayShifts.length > MAX_CHIPS && (
                    <span className="cell-more">+{dayShifts.length - MAX_CHIPS}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
