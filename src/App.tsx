import { useState } from 'react'
import QuizView from './components/QuizView'
import SettingsPanel from './components/SettingsPanel'
import { useSettings } from './SettingsContext'

function App() {
  const { settings, update } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-title">MCQ Quiz</span>
        <div className="topbar-actions">
          <button
            className="theme-toggle"
            onClick={() => update({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="settings-toggle"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>
      <main className="content">
        <QuizView />
      </main>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default App