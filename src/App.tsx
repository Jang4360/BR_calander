import { useCallback, useEffect, useMemo, useState } from 'react'
import { Shift, Staff } from './types'
import { StoreData } from './types'
import { store, usingCloud } from './store'
import { toDateStr } from './util'
import MonthView from './components/MonthView'
import DaySheet from './components/DaySheet'
import ShiftEditor, { EditorTarget, ShiftInput } from './components/ShiftEditor'
import Settlement from './components/Settlement'

export default function App() {
  const [data, setData] = useState<StoreData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState<'calendar' | 'settle'>('calendar')
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

  async function guard(fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
    } catch (e) {
      alert(`저장에 실패했어요: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleAddStaff(name: string): Promise<Staff> {
    const s = await store.addStaff(name.trim())
    setData(d => (d ? { ...d, staff: [...d.staff, s] } : d))
    return s
  }

  function handleToggleStaffActive(id: string, active: boolean) {
    guard(async () => {
      await store.setStaffActive(id, active)
      setData(d =>
        d ? { ...d, staff: d.staff.map(s => (s.id === id ? { ...s, active } : s)) } : d,
      )
    })
  }

  function handleRenameStaff(id: string, name: string) {
    guard(async () => {
      await store.updateStaff(id, name)
      setData(d =>
        d ? { ...d, staff: d.staff.map(s => (s.id === id ? { ...s, name } : s)) } : d,
      )
    })
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

  function handleSaveShift(input: ShiftInput): Promise<void> {
    return guard(async () => {
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
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + dir, 1))
  }

  // 요일별로 일정이 처음 입력된 날을 패턴으로 삼아, 이후 같은 요일에 복사 (이 달 안에서만)
  function handleCopyMonth() {
    if (!data) return
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()

    // 요일(0~6)별 첫 일정이 있는 날짜 찾기
    const srcDayOfWeekday = new Map<number, number>()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d)
      const wd = date.getDay()
      if (srcDayOfWeekday.has(wd)) continue
      if (data.shifts.some(s => s.date === toDateStr(date))) srcDayOfWeekday.set(wd, d)
    }

    const toCreate: Omit<Shift, 'id'>[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d)
      const srcDay = srcDayOfWeekday.get(date.getDay())
      if (srcDay === undefined || d <= srcDay) continue
      const ds = toDateStr(date)
      const srcDs = toDateStr(new Date(y, m, srcDay))
      for (const s of data.shifts.filter(sh => sh.date === srcDs)) {
        const exists = data.shifts.some(
          t =>
            t.date === ds &&
            t.staff_id === s.staff_id &&
            t.start_min === s.start_min &&
            t.end_min === s.end_min,
        )
        if (!exists) {
          toCreate.push({ staff_id: s.staff_id, date: ds, start_min: s.start_min, end_min: s.end_min })
        }
      }
    }

    if (toCreate.length === 0) {
      alert(`${m + 1}월에 복사할 일정이 없거나, 이미 모두 복사되어 있어요.`)
      return
    }
    if (
      !confirm(
        `요일별로 처음 입력된 날의 일정을 ${m + 1}월의 이후 같은 요일에 복사할까요?\n총 ${toCreate.length}개의 일정이 추가돼요. (다음 달에는 생성되지 않아요)`,
      )
    ) {
      return
    }
    guard(async () => {
      const created = await store.addShifts(toCreate)
      setData(d => (d ? { ...d, shifts: [...d.shifts, ...created] } : d))
      alert(`${created.length}개의 일정을 복사했어요.`)
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
        onAddStaff={handleAddStaff}
        onRenameStaff={handleRenameStaff}
        onToggleActive={handleToggleStaffActive}
        onDeleteStaff={handleDeleteStaff}
        onBack={() => setPage('calendar')}
      />
    )
  }

  const title = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`

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
          <button className="btn btn-small" onClick={handleCopyMonth}>
            월 전체 복사
          </button>
          <button className="btn btn-small btn-settle" onClick={() => setPage('settle')}>
            정산
          </button>
        </div>
      </header>

      {!usingCloud && (
        <div className="notice">임시 저장 모드 — 지금은 이 기기에만 저장돼요</div>
      )}

      <MonthView
        cursor={cursor}
        shifts={data.shifts}
        staffById={staffById}
        onSelectDate={d => setSheetDate(d)}
      />

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
