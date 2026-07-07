import { useState } from 'react'
import { Shift, Staff } from '../types'
import { fmtDayTitle, minToStr } from '../util'
import { matchPreset, presetTimes, presetTimeLabel, PRESET_NAMES, PresetKey } from '../presets'

export interface EditorTarget {
  shift?: Shift
  date: string
}

export interface ShiftInput {
  id?: string
  staff_id: string
  date: string
  start_min: number
  end_min: number
}

interface Props {
  target: EditorTarget
  staff: Staff[]
  onClose: () => void
  onSave: (input: ShiftInput) => void
  onDelete: (id: string) => void
  onAddStaff: (name: string) => Promise<Staff>
}

const STEP = 30

export default function ShiftEditor({ target, staff, onClose, onSave, onDelete, onAddStaff }: Props) {
  const editing = target.shift
  const [date, setDate] = useState(target.date)
  const [staffId, setStaffId] = useState(editing?.staff_id ?? '')
  const [start, setStart] = useState(editing?.start_min ?? presetTimes('open', target.date).start)
  const [end, setEnd] = useState(editing?.end_min ?? presetTimes('open', target.date).end)
  const [newName, setNewName] = useState('')
  const [showNewStaff, setShowNewStaff] = useState(staff.length === 0)
  const [saving, setSaving] = useState(false)

  const activePreset = matchPreset(date, start, end)

  function applyPreset(key: PresetKey) {
    const t = presetTimes(key, date)
    setStart(t.start)
    setEnd(t.end)
  }

  function changeDate(newDate: string) {
    if (!newDate) return
    // 프리셋(오픈)은 요일마다 시간이 다르므로 날짜 변경 시 다시 계산
    if (activePreset) {
      const t = presetTimes(activePreset, newDate)
      setStart(t.start)
      setEnd(t.end)
    }
    setDate(newDate)
  }

  async function addStaff() {
    const name = newName.trim()
    if (!name) return
    if (staff.some(s => s.name === name)) {
      alert('이미 등록된 이름이에요.')
      return
    }
    try {
      const s = await onAddStaff(name)
      setStaffId(s.id)
      setNewName('')
      setShowNewStaff(false)
    } catch (e) {
      alert(`등록에 실패했어요: ${e instanceof Error ? e.message : e}`)
    }
  }

  function save() {
    if (!staffId) {
      alert('알바생을 선택해주세요.')
      return
    }
    if (end <= start) {
      alert('종료 시간이 시작 시간보다 늦어야 해요.')
      return
    }
    setSaving(true)
    onSave({ id: editing?.id, staff_id: staffId, date, start_min: start, end_min: end })
  }

  const startOptions: number[] = []
  for (let m = 0; m < 24 * 60; m += STEP) startOptions.push(m)
  const endOptions: number[] = []
  for (let m = start + STEP; m <= 24 * 60; m += STEP) endOptions.push(m)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{editing ? '일정 수정' : '일정 추가'}</h2>
          <button className="btn btn-small" onClick={onClose}>
            닫기
          </button>
        </div>

        <label className="field-label">날짜</label>
        <div className="date-row">
          <input
            type="date"
            className="date-input"
            value={date}
            onChange={e => changeDate(e.target.value)}
          />
          <span className="date-preview">{fmtDayTitle(date)}</span>
        </div>

        <label className="field-label">알바생</label>
        <div className="staff-chips">
          {staff.map(s => (
            <button
              key={s.id}
              className={`chip ${staffId === s.id ? 'active' : ''}`}
              onClick={() => setStaffId(s.id)}
            >
              {s.name}
            </button>
          ))}
          <button className="chip chip-add" onClick={() => setShowNewStaff(v => !v)}>
            ＋ 새 알바생
          </button>
        </div>
        {showNewStaff && (
          <div className="new-staff-row">
            <input
              className="text-input"
              placeholder="이름 입력 (예: 민준)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStaff()}
            />
            <button className="btn btn-primary" onClick={addStaff}>
              등록
            </button>
          </div>
        )}

        <label className="field-label">근무 시간대</label>
        <div className="preset-row">
          {(['open', 'middle', 'close'] as PresetKey[]).map(key => (
            <button
              key={key}
              className={`preset-btn ${activePreset === key ? 'active' : ''}`}
              onClick={() => applyPreset(key)}
            >
              <span className="preset-name">{PRESET_NAMES[key]}</span>
              <span className="preset-time">{presetTimeLabel(key, date)}</span>
            </button>
          ))}
        </div>

        <label className="field-label">시간 직접 조정 (30분 단위)</label>
        <div className="time-row">
          <div className="time-field">
            <span>시작</span>
            <select
              className="time-select"
              value={start}
              onChange={e => {
                const v = Number(e.target.value)
                setStart(v)
                if (end <= v) setEnd(Math.min(v + STEP, 24 * 60))
              }}
            >
              {startOptions.map(m => (
                <option key={m} value={m}>
                  {minToStr(m)}
                </option>
              ))}
            </select>
          </div>
          <span className="time-tilde">~</span>
          <div className="time-field">
            <span>종료</span>
            <select className="time-select" value={end} onChange={e => setEnd(Number(e.target.value))}>
              {endOptions.map(m => (
                <option key={m} value={m}>
                  {minToStr(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="btn btn-primary btn-big" onClick={save} disabled={saving}>
          {editing ? '수정 완료' : '일정 추가'}
        </button>
        {editing && (
          <button className="btn btn-danger btn-big" onClick={() => onDelete(editing.id)}>
            이 일정 삭제
          </button>
        )}
      </div>
    </div>
  )
}
