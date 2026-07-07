import { useState } from 'react'
import { Shift, Staff } from '../types'
import { fmtDayTitle, minToStr } from '../util'
import {
  classifyShift,
  presetTimes,
  presetTimeLabel,
  PRESET_COLORS,
  PRESET_NAMES,
  PRESET_ORDER,
  PresetKey,
} from '../presets'

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
  onSave: (input: ShiftInput) => Promise<void>
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
  const [addingStaff, setAddingStaff] = useState(false)

  // 선택지는 현재 근무자만. 단, 수정 중인 일정의 담당자가 이전 근무자면 그 사람은 표시
  const selectableStaff = staff.filter(s => s.active !== false || s.id === staffId)

  // 현재 시간이 어떤 시간대(조합)에 해당하는지 (±1시간 오차 허용)
  const active = classifyShift(date, start, end)

  function applyCombo(keys: PresetKey[], targetDate: string) {
    setStart(presetTimes(keys[0], targetDate).start)
    setEnd(presetTimes(keys[keys.length - 1], targetDate).end)
  }

  // 시간대 버튼 토글 (중복 선택 가능, 사이가 비면 자동으로 이어짐)
  function togglePreset(key: PresetKey) {
    const set = new Set(active)
    if (set.has(key)) {
      if (set.size <= 1) {
        // 마지막 하나를 다시 누르면 그 시간대의 기본 시간으로 리셋
        applyCombo([key], date)
        return
      }
      set.delete(key)
    } else {
      set.add(key)
    }
    applyCombo(PRESET_ORDER.filter(k => set.has(k)), date)
  }

  function changeDate(newDate: string) {
    if (!newDate) return
    // 오픈은 요일마다 시간이 다르므로 날짜 변경 시 선택된 시간대를 다시 계산
    if (active.length) applyCombo(active, newDate)
    setDate(newDate)
  }

  async function addStaff() {
    const name = newName.trim()
    if (!name || addingStaff) return
    if (staff.some(s => s.name === name)) {
      alert('이미 등록된 이름이에요.')
      return
    }
    setAddingStaff(true)
    try {
      const s = await onAddStaff(name)
      setStaffId(s.id)
      setNewName('')
      setShowNewStaff(false)
    } catch (e) {
      alert(`등록에 실패했어요: ${e instanceof Error ? e.message : e}`)
    } finally {
      setAddingStaff(false)
    }
  }

  async function save() {
    if (saving) return
    if (!staffId) {
      alert('알바생을 선택해주세요.')
      return
    }
    if (end <= start) {
      alert('종료 시간이 시작 시간보다 늦어야 해요.')
      return
    }
    setSaving(true)
    await onSave({ id: editing?.id, staff_id: staffId, date, start_min: start, end_min: end })
    setSaving(false)
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
          {selectableStaff.map(s => (
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
            <button className="btn btn-primary" onClick={addStaff} disabled={addingStaff}>
              등록
            </button>
          </div>
        )}

        <label className="field-label">근무 시간대 (중복 선택 가능)</label>
        <div className="preset-row">
          {PRESET_ORDER.map(key => (
            <button
              key={key}
              className={`preset-btn ${active.includes(key) ? 'active' : ''}`}
              onClick={() => togglePreset(key)}
            >
              <span className="preset-name">
                <span className="preset-dot" style={{ background: PRESET_COLORS[key].bg }} />
                {PRESET_NAMES[key]}
              </span>
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
