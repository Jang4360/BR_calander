import { Shift, Staff } from '../types'
import { fmtDayTitle, minToStr } from '../util'
import { classifyShift, comboLabel, shiftColor } from '../presets'

interface Props {
  date: string
  shifts: Shift[]
  staffById: Map<string, Staff>
  onClose: () => void
  onAdd: () => void
  onEdit: (shift: Shift) => void
  onDelete: (shift: Shift) => void
}

export default function DaySheet({ date, shifts, staffById, onClose, onAdd, onEdit, onDelete }: Props) {
  const sorted = [...shifts].sort((a, b) => a.start_min - b.start_min)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{fmtDayTitle(date)}</h2>
          <button className="btn btn-small" onClick={onClose}>
            닫기
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="empty-text">등록된 일정이 없어요.</p>
        ) : (
          <ul className="shift-list">
            {sorted.map(s => {
              const st = staffById.get(s.staff_id)
              const combo = classifyShift(s.date, s.start_min, s.end_min)
              const col = shiftColor(s.date, s.start_min, s.end_min)
              return (
                <li key={s.id} className="shift-row">
                  <span className="dot" style={{ background: col.bg }} />
                  <div className="shift-info">
                    <div className="shift-name">
                      {st?.name ?? '삭제된 알바생'}
                      {combo.length > 0 && (
                        <span
                          className="preset-badge"
                          style={{ background: col.bg, color: col.text }}
                        >
                          {comboLabel(combo)}
                        </span>
                      )}
                    </div>
                    <div className="shift-time">
                      {minToStr(s.start_min)} ~ {minToStr(s.end_min)}
                    </div>
                  </div>
                  <button className="btn btn-small" onClick={() => onEdit(s)}>
                    수정
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => onDelete(s)}>
                    삭제
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button className="btn btn-primary btn-big" onClick={onAdd}>
          ＋ 일정 추가
        </button>
      </div>
    </div>
  )
}
