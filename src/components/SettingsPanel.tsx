import { useSettings } from '../SettingsContext'

export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings()
  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <label className="setting-row">
          <span>
            Instant Answer Feedback
            <small>Shows correct/wrong right after answering. Forced on in Loop Mode.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.instantFeedback}
            onChange={e => update({ instantFeedback: e.target.checked })}
          />
        </label>

        <label className="setting-row">
          <span>Randomize answer order</span>
          <input
            type="checkbox"
            checked={settings.randomizeOptions}
            onChange={e => update({ randomizeOptions: e.target.checked })}
          />
        </label>

        <label className="setting-row">
          <span>Randomize question order</span>
          <input
            type="checkbox"
            checked={settings.randomizeQuestionOrder}
            onChange={e => update({ randomizeQuestionOrder: e.target.checked })}
          />
        </label>
      </div>
    </div>
  )
}