import { useCallback, useEffect, useMemo, useState } from 'react'
import { Shift, Staff } from './types'
import { StoreData } from './types'
import { store, usingCloud } from './store'
import { STAFF_COLORS } from './config'
import { addDays, startOfWeek, toDateStr } from './util'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DaySheet from './components/DaySheet'
import ShiftEditor, { EditorTarget, ShiftInput } from './components/ShiftEditor'
import Settlement from './components/Settlement'

export default function App() {
  const [data, setData] = useState<StoreData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState<'calendar' | 'settle'>('calendar')
  const [view, setView] = useState<'month' | 'week'>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [sheetDate, setSheetDate] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorTarget | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await store.loadAll())
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // 다른 기기에서 수정한 내용 반영: 앱으로 돌아올 때 다시 불러오기
  useEffect(() => {
    if (!usingCloud) return
    const onFocus = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [reload])

  const staffById = useMemo(() => {
    const m = new Map<string, Staff>()
    data?.staff.forEach(s => m.set(s.id, s))
    return m
  }, [data?.staff])

  async function guard(fn: () => Promise<void>) {
    try {
      await fn()
    } catch (e) {
      alert(`저장에 실패했어요: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleAddStaff(name: string): Promise<Staff> {
    const color = STAFF_COLORS[(data?.staff.length ?? 0) % STAFF_COLORS.length]
    const s = await store.addStaff(name.trim(), color)
    setData(d => (d ? { ...d, staff: [...d.staff, s] } : d))
    return s
  }

  function handleDeleteStaff(id: string) {
    guard(async () => {
      await store.deleteStaff(id)
      setData(d =>
        d
          ? {
              ...d,
              staff: d.staff.filter(s => s.id !== id),
              shifts: d.shifts.filter(s => s.staff_id !== id),
            }
          : d,
      )
    })
  }

  function handleSaveShift(input: ShiftInput) {
    guard(async () => {
      if (input.id) {
        const shift: Shift = { ...input, id: input.id }
        await store.updateShift(shift)
        setData(d =>
          d ? { ...d, shifts: d.shifts.map(s => (s.id === shift.id ? shift : s)) } : d,
        )
      } else {
        const created = await store.addShift({
          staff_id: input.staff_id,
          date: input.date,
          start_min: input.start_min,
          end_min: input.end_min,
        })
        setData(d => (d ? { ...d, shifts: [...d.shifts, created] } : d))
      }
      // 저장하면 편집창과 날짜 시트를 모두 닫고 캘린더로 복귀
      setEditor(null)
      setSheetDate(null)
    })
  }

  function handleDeleteShift(id: string) {
    if (!confirm('이 일정을 삭제할까요?')) return
    guard(async () => {
      await store.deleteShift(id)
      setData(d => (d ? { ...d, shifts: d.shifts.filter(s => s.id !== id) } : d))
      setEditor(null)
    })
  }

  function handleSetWage(wage: number) {
    guard(async () => {
      await store.setWage(wage)
      setData(d => (d ? { ...d, wage } : d))
    })
  }

  function moveCursor(dir: -1 | 1) {
    setCursor(c => {
      if (view === 'month') return new Date(c.getFullYear(), c.getMonth() + dir, 1)
      return addDays(c, dir * 7)
    })
  }

  if (loadError) {
    return (
      <div className="app">
        <div className="center-box">
          <p>데이터를 불러오지 못했어요.</p>
          <p className="error-detail">{loadError}</p>
          <button className="btn btn-primary" onClick={reload}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app">
        <div className="center-box">불러오는 중…</div>
      </div>
    )
  }

  if (page === 'settle') {
    return (
      <Settlement
        staff={data.staff}
        shifts={data.shifts}
        wage={data.wage}
        onSetWage={handleSetWage}
        onDeleteStaff={handleDeleteStaff}
        onBack={() => setPage('calendar')}
      />
    )
  }

  const weekStart = startOfWeek(cursor)
  const weekEnd = addDays(weekStart, 6)
  const title =
    view === 'month'
      ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`
      : `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <button className="nav-btn" onClick={() => moveCursor(-1)} aria-label="이전">
            ‹
          </button>
          <div className="header-title">{title}</div>
          <button className="nav-btn" onClick={() => moveCursor(1)} aria-label="다음">
            ›
          </button>
        </div>
        <div className="header-row header-row2">
          <button className="btn btn-small" onClick={() => setCursor(new Date())}>
            오늘
          </button>
          <div className="segment">
            <button
              className={view === 'month' ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setView('month')}
            >
              월
            </button>
            <button
              className={view === 'week' ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setView('week')}
            >
              주
            </button>
          </div>
          <button className="btn btn-small btn-settle" onClick={() => setPage('settle')}>
            정산
          </button>
        </div>
      </header>

      {!usingCloud && (
        <div className="notice">임시 저장 모드 — 지금은 이 기기에만 저장돼요</div>
      )}

      {view === 'month' ? (
        <MonthView
          cursor={cursor}
          shifts={data.shifts}
          staffById={staffById}
          onSelectDate={d => setSheetDate(d)}
        />
      ) : (
        <WeekView
          cursor={cursor}
          shifts={data.shifts}
          staffById={staffById}
          onSelectDate={d => setSheetDate(d)}
          onEditShift={s => setEditor({ shift: s, date: s.date })}
        />
      )}

      <div className="hint">날짜를 누르면 일정을 보고 추가할 수 있어요</div>

      <button
        className="fab"
        onClick={() => setEditor({ date: toDateStr(new Date()) })}
        aria-label="오늘 일정 추가"
      >
        ＋ 일정 추가
      </button>

      {sheetDate && !editor && (
        <DaySheet
          date={sheetDate}
          shifts={data.shifts.filter(s => s.date === sheetDate)}
          staffById={staffById}
          onClose={() => setSheetDate(null)}
          onAdd={() => setEditor({ date: sheetDate })}
          onEdit={s => setEditor({ shift: s, date: s.date })}
          onDelete={s => handleDeleteShift(s.id)}
        />
      )}

      {editor && (
        <ShiftEditor
          target={editor}
          staff={data.staff}
          onClose={() => {
            setEditor(null)
            setSheetDate(null)
          }}
          onSave={handleSaveShift}
          onDelete={handleDeleteShift}
          onAddStaff={handleAddStaff}
        />
      )}
    </div>
  )
}
