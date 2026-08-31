import QuizView from './components/QuizView'
import { useSettings } from './SettingsContext'

function App() {
  const { settings, update } = useSettings()

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
        </div>
      </header>
      <main className="content">
        <QuizView />
      </main>
    </div>
  )
}

export default App
