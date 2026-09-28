import { useCallback, useEffect, useMemo, useState } from 'react'
import { Shift, Staff } from './types'
import { StoreData } from './types'
import { store, usingCloud } from './store'
import { addDays, fmtDayTitle, fromDateStr, startOfWeekMonday, toDateStr, weekLabel } from './util'
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
  // 선택한 주 복사 모드: 원본 주(월요일 시작일)와 목적지 주(사용자가 탭한 시작일)
  const [weekCopy, setWeekCopy] = useState<{ sourceStart: string; destStart: string | null } | null>(
    null,
  )

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

  // "선택한 주 복사" 드롭다운: 오늘이 속한 주부터 거슬러 최근 10주 중 일정이 있는 주만
  const recentWeekOptions = useMemo(() => {
    if (!data) return []
    const thisWeekMonday = startOfWeekMonday(new Date())
    const options: { start: string; label: string }[] = []
    for (let i = 0; i < 10; i++) {
      const monday = addDays(thisWeekMonday, -7 * i)
      const start = toDateStr(monday)
      const hasShift = Array.from({ length: 7 }, (_, j) => toDateStr(addDays(monday, j))).some(ds =>
        data.shifts.some(s => s.date === ds),
      )
      if (hasShift) options.push({ start, label: weekLabel(monday) })
    }
    return options
  }, [data])

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

  // 해당 월의 첫 주 패턴: 요일별로 일정이 처음 입력된 날짜와 그 날의 일정 목록
  function firstWeekPattern(y: number, m: number): Map<number, { day: number; shifts: Shift[] }> {
    const pattern = new Map<number, { day: number; shifts: Shift[] }>()
    if (!data) return pattern
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d)
      const wd = date.getDay()
      if (pattern.has(wd)) continue
      const dayShifts = data.shifts.filter(s => s.date === toDateStr(date))
      if (dayShifts.length) pattern.set(wd, { day: d, shifts: dayShifts })
    }
    return pattern
  }

  // 패턴을 (y, m)월의 같은 요일에 복사할 일정 목록 생성. 이미 있는 동일 일정은 제외.
  // skipSourceMonth=true면 패턴이 이번 달 것이므로 기준일 이전 날짜는 건너뜀
  function planCopies(
    pattern: Map<number, { day: number; shifts: Shift[] }>,
    y: number,
    m: number,
    skipSourceMonth: boolean,
  ): Omit<Shift, 'id'>[] {
    if (!data) return []
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const toCreate: Omit<Shift, 'id'>[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d)
      const p = pattern.get(date.getDay())
      if (!p) continue
      if (skipSourceMonth && d <= p.day) continue
      const ds = toDateStr(date)
      for (const s of p.shifts) {
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
    return toCreate
  }

  function runCopy(toCreate: Omit<Shift, 'id'>[], confirmMsg: string) {
    if (!confirm(`${confirmMsg}\n총 ${toCreate.length}개의 일정이 추가돼요.`)) return
    guard(async () => {
      const created = await store.addShifts(toCreate)
      setData(d => (d ? { ...d, shifts: [...d.shifts, ...created] } : d))
      alert(`${created.length}개의 일정을 복사했어요.`)
    })
  }

  // 선택한 주 복사 모드 시작 (기본 원본 주: 목록의 첫 항목 = 가장 최근 일정이 있는 주)
  function startWeekCopy() {
    if (recentWeekOptions.length === 0) {
      alert('최근 10주 안에 등록된 일정이 없어서 복사할 원본 주가 없어요.')
      return
    }
    setWeekCopy({ sourceStart: recentWeekOptions[0].start, destStart: null })
  }

  function cancelWeekCopy() {
    setWeekCopy(null)
  }

  // 원본 주(7일)를 목적지 주(7일)에 순서대로 그대로 복사 (요일 무관, 1일째→1일째 방식)
  function confirmWeekCopy() {
    if (!data || !weekCopy?.destStart) return
    const srcStart = weekCopy.sourceStart
    const dstStart = weekCopy.destStart
    const toCreate: Omit<Shift, 'id'>[] = []
    for (let i = 0; i < 7; i++) {
      const srcDs = toDateStr(addDays(fromDateStr(srcStart), i))
      const dstDs = toDateStr(addDays(fromDateStr(dstStart), i))
      for (const s of data.shifts.filter(sh => sh.date === srcDs)) {
        const exists = data.shifts.some(
          t =>
            t.date === dstDs &&
            t.staff_id === s.staff_id &&
            t.start_min === s.start_min &&
            t.end_min === s.end_min,
        )
        if (!exists) {
          toCreate.push({ staff_id: s.staff_id, date: dstDs, start_min: s.start_min, end_min: s.end_min })
        }
      }
    }
    if (toCreate.length === 0) {
      alert('복사할 일정이 없거나, 이미 모두 복사되어 있어요.')
      return
    }
    const srcLabel = weekLabel(fromDateStr(srcStart))
    const dstEnd = toDateStr(addDays(fromDateStr(dstStart), 6))
    if (
      !confirm(
        `${srcLabel} 일정을 ${fmtDayTitle(dstStart)} ~ ${fmtDayTitle(dstEnd)}에 복사할까요?\n총 ${toCreate.length}개의 일정이 추가돼요.`,
      )
    ) {
      return
    }
    guard(async () => {
      const created = await store.addShifts(toCreate)
      setData(d => (d ? { ...d, shifts: [...d.shifts, ...created] } : d))
      alert(`${created.length}개의 일정을 복사했어요.`)
      setWeekCopy(null)
    })
  }

  // 지난달 첫 주 일정을 이번 달 전체에 복사
  function handleCopyPrevMonth() {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const prev = new Date(y, m - 1, 1)
    const pattern = firstWeekPattern(prev.getFullYear(), prev.getMonth())
    if (pattern.size === 0) {
      alert(`${prev.getMonth() + 1}월에 입력된 일정이 없어요.`)
      return
    }
    const toCreate = planCopies(pattern, y, m, false)
    if (toCreate.length === 0) {
      alert(`이미 모두 복사되어 있어요.`)
      return
    }
    runCopy(
      toCreate,
      `${prev.getMonth() + 1}월 첫 주 일정을 ${m + 1}월 전체의 같은 요일에 복사할까요?`,
    )
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
        {weekCopy ? (
          <div className="header-row header-row2 week-copy-row">
            <select
              className="week-copy-select"
              value={weekCopy.sourceStart}
              onChange={e => setWeekCopy(w => (w ? { ...w, sourceStart: e.target.value } : w))}
            >
              {recentWeekOptions.map(opt => (
                <option key={opt.start} value={opt.start}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-small btn-primary"
              onClick={confirmWeekCopy}
              disabled={!weekCopy.destStart}
            >
              복사
            </button>
          </div>
        ) : (
          <div className="header-row header-row2">
            <button className="btn btn-small" onClick={() => setCursor(new Date())}>
              오늘
            </button>
            <button className="btn btn-small" onClick={startWeekCopy}>
              선택한 주 복사
            </button>
            <button className="btn btn-small" onClick={handleCopyPrevMonth}>
              전월 복사
            </button>
            <button className="btn btn-small btn-settle" onClick={() => setPage('settle')}>
              정산
            </button>
          </div>
        )}
      </header>

      {!usingCloud && (
        <div className="notice">임시 저장 모드 — 지금은 이 기기에만 저장돼요</div>
      )}

      {weekCopy && (
        <div className="notice notice-accent">
          {weekCopy.destStart
            ? `붙여넣을 주: ${fmtDayTitle(weekCopy.destStart)} ~ ${fmtDayTitle(toDateStr(addDays(fromDateStr(weekCopy.destStart), 6)))}`
            : '복사할 시작 날짜를 캘린더에서 탭하세요'}
        </div>
      )}

      <MonthView
        cursor={cursor}
        shifts={data.shifts}
        staffById={staffById}
        onSelectDate={d => setSheetDate(d)}
        pickMode={
          weekCopy
            ? {
                onPick: ds => setWeekCopy(w => (w ? { ...w, destStart: ds } : w)),
                rangeHighlight: weekCopy.destStart
                  ? {
                      start: weekCopy.destStart,
                      end: toDateStr(addDays(fromDateStr(weekCopy.destStart), 6)),
                    }
                  : null,
              }
            : undefined
        }
      />

      {!weekCopy && <div className="hint">날짜를 누르면 일정을 보고 추가할 수 있어요</div>}

      <button
        className={weekCopy ? 'fab fab-cancel' : 'fab'}
        onClick={() =>
          weekCopy ? cancelWeekCopy() : setEditor({ date: toDateStr(new Date()) })
        }
        aria-label={weekCopy ? '주 복사 취소' : '오늘 일정 추가'}
      >
        {weekCopy ? '취소' : '＋ 일정 추가'}
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
