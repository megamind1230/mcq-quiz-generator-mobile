import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../SettingsContext'
import { parseMcqFile } from '../utils/mcqParser'
import { logQuizResult, loadQuizResults } from '../utils/quizLogger'
import { renderRichText, getRawContent, clearRawContentMap } from '../utils/renderRichText'
import { shuffle } from '../utils/shuffle'
import { buildHtml, type ExportData, type ExportFormat } from '../utils/quizExporter'
import { exportAssets } from '../utils/cssAssets'
import { decryptMcq, isEncrypted } from '../lib/crypto'
import { advanceLoop, BLOCK_SIZE, exactMatch, isAnswered, type QuizMode } from '../utils/quizModes'
import { formatTime, LABELS } from '../utils/format'
import type { McqDocument, McqQuestion, QuizResult } from '../types'

type QuizState = 'home' | 'active' | 'results'

export default function QuizView() {
  const { settings } = useSettings()
  const [state, setState] = useState<QuizState>('home')
  const [doc, setDoc] = useState<McqDocument | null>(null)
  const [pendingDoc, setPendingDoc] = useState<McqDocument | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [questions, setQuestions] = useState<McqQuestion[]>([])
  const [mode, setMode] = useState<QuizMode>('classic')
  const [pool, setPool] = useState<McqQuestion[]>([])
  const [mastered, setMastered] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [history, setHistory] = useState<QuizResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lastDir, setLastDir] = useState<string | null>(() => localStorage.getItem('mcq-last-open'))

  useEffect(() => {
    setHistory(loadQuizResults())
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── File import ──────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setError(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      setError('Could not read the file.')
      return
    }

    let content = text
    if (isEncrypted(text) || file.name.toLowerCase().endsWith('.emcq')) {
      content = (await decryptMcq(text)) || ''
      if (!content) {
        setError('Could not decrypt this .emcq file.')
        return
      }
    }

    const parsed = parseMcqFile(content)
    if (!parsed || parsed.questions.length === 0) {
      setError('This file does not contain a valid quiz.')
      return
    }
    if (parsed.questions.length > 50) {
      setError('This quiz has more than 50 questions, which is not supported.')
      return
    }

    localStorage.setItem('mcq-last-open', file.name)
    setLastDir(file.name)
    setPendingDoc(parsed)
  }

  const pickMode = (mode: QuizMode) => {
    if (!pendingDoc) return
    setPendingDoc(null)
    startQuiz(pendingDoc, mode)
  }

  const startQuiz = (parsed: McqDocument, mode: QuizMode) => {
    setDoc(parsed)
    let qs = parsed.questions.map(q => {
      if (settings.randomizeOptions) {
        const optionOrder = shuffle(q.options.map((_, i) => i))
        return {
          ...q,
          options: optionOrder.map(i => q.options[i]),
          correctIndices: q.correctIndices.map(idx => optionOrder.indexOf(idx))
        }
      }
      return { ...q }
    })
    if (settings.randomizeQuestionOrder) qs = shuffle(qs)

    setMode(mode)
    setMastered(false)
    const cleared = qs.map(q => ({ ...q, selectedIndices: undefined }))
    if (mode === 'loop') {
      setPool(cleared)
      setQuestions(cleared.slice(0, BLOCK_SIZE))
    } else {
      setPool([])
      setQuestions(cleared)
    }
    setCurrentIdx(0)
    setElapsed(0)
    setState('active')
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const leaveQuiz = () => {
    if (!confirm('Leave quiz? Your progress will be lost.')) return
    stopTimer()
    clearRawContentMap()
    setState('home')
  }

  const selectAnswer = (optIdx: number) => {
    const locked = (mode === 'loop' || mode === 'instant') && isAnswered(questions[currentIdx])
    if (locked) return
    setQuestions(prev => {
      const next = [...prev]
      const cur = next[currentIdx]
      if (cur.multiAnswer) {
        const curSel = cur.selectedIndices || []
        const newSel = curSel.includes(optIdx)
          ? curSel.filter(i => i !== optIdx)
          : [...curSel, optIdx]
        next[currentIdx] = { ...cur, selectedIndices: newSel.length ? newSel : undefined }
      } else {
        const newSel = cur.selectedIndices?.[0] === optIdx ? undefined : [optIdx]
        next[currentIdx] = { ...cur, selectedIndices: newSel }
      }
      return next
    })
  }

  const goNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1)
  }
  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1)
  }

  const advanceLoopNow = () => {
    if (!questions.every(isAnswered)) return
    const { done, pool: nextPool, batch } = advanceLoop(pool, questions)
    if (done) {
      stopTimer()
      clearRawContentMap()
      setMastered(true)
      setState('home')
    } else {
      setPool(nextPool)
      setQuestions(batch)
      setCurrentIdx(0)
    }
  }

  const finishQuiz = () => {
    stopTimer()
    const correct = questions.filter(q => exactMatch(q)).length
    const result: QuizResult = {
      timestamp: new Date().toISOString(),
      title: doc?.title || 'Unknown',
      source: doc?.source || '',
      totalQuestions: questions.length,
      correctAnswers: correct,
      timeTakenSeconds: elapsed
    }
    logQuizResult(result)
    setHistory(loadQuizResults())
    setState('results')
  }

  const handleExport = (format: ExportFormat) => {
    if (!doc) return
    const correct = questions.filter(q => exactMatch(q)).length
    const data: ExportData = {
      title: doc.title,
      correct,
      total: questions.length,
      timeTakenSeconds: elapsed,
      questions
    }
    const html = buildHtml(data, exportAssets())
    const win = window.open('', '_blank')
    if (!win) {
      setError('Popup blocked. Please allow popups for this app to export.')
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
    if (format === 'pdf') {
      win.focus()
      setTimeout(() => win.print(), 300)
    }
  }

  // Copy handler for rich content
  useEffect(() => {
    if (state !== 'active') return
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      const target = el.closest('[data-copy-id]') as HTMLElement | null
      if (!target) return
      const id = target.getAttribute('data-copy-id')!
      const raw = getRawContent(id)
      if (!raw) return
      navigator.clipboard.writeText(raw)
      if (target.classList.contains('copy-btn')) {
        const prev = target.textContent
        target.textContent = 'Copied!'
        setTimeout(() => { target.textContent = prev }, 1000)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [state])

  // ── Keyboard shortcuts ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'q') {
        if (pendingDoc) {
          setPendingDoc(null)
          return
        }
        if (state === 'active' || state === 'results') {
          stopTimer()
          clearRawContentMap()
          setState('home')
        }
        return
      }

      if (state !== 'active') return
      if (e.key === 'n' || e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      else if (e.key === 'p' || e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
      else if (e.key === 'a') selectAnswer(0)
      else if (e.key === 'b') selectAnswer(1)
      else if (e.key === 'c') selectAnswer(2)
      else if (e.key === 'd') selectAnswer(3)
      else if (e.key === 'j') {
        e.preventDefault()
        document.querySelector('.content')?.scrollBy({ top: 40, behavior: 'smooth' })
      }
      else if (e.key === 'k') {
        e.preventDefault()
        document.querySelector('.content')?.scrollBy({ top: -40, behavior: 'smooth' })
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, currentIdx, questions, pendingDoc])

  // ── Home ─────────────────────────────────────────────────────
  if (state === 'home') {
    return (
      <div className="home">
        <div className="home-hero">
          <div className="app-logo">✓</div>
          <h1>MCQ Quiz</h1>
          <p>Open an exam file to begin.</p>
          {mastered && <div className="mastered-msg">All questions mastered! 🎉</div>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".mcq,.emcq,.txt,.md,.org"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <button className="open-btn" onClick={() => fileInputRef.current?.click()}>
          Open Exam
        </button>
        {lastDir && <div className="last-open-hint">Last opened: {lastDir}</div>}
        {error && <div className="error">{error}</div>}

        <div className="history">
          <div className="history-head">
            <h2>History</h2>
          </div>
          {history.length === 0 ? (
            <p className="empty">No results yet.</p>
          ) : (
            <ul className="history-list">
              {[...history].reverse().map((r, i) => {
                const pct = Math.round((r.correctAnswers / r.totalQuestions) * 100)
                return (
                  <li key={i} className="history-item">
                    <div className="history-title">{r.title}</div>
                    <div className="history-meta">
                      {r.correctAnswers}/{r.totalQuestions} ({pct}%) · {formatTime(r.timeTakenSeconds)} · {new Date(r.timestamp).toLocaleString()}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {pendingDoc && (
          <div className="overlay" onClick={() => setPendingDoc(null)}>
            <div className="mode-picker" onClick={e => e.stopPropagation()}>
              <h2>Choose a mode</h2>
              <button className="mode-btn" onClick={() => pickMode('loop')}>
                <strong>Loop Mode</strong>
                <span>Instant feedback · retakes wrong answers every 15 questions · no results page</span>
              </button>
              <button className="mode-btn" onClick={() => pickMode('instant')}>
                <strong>Instant Mode</strong>
                <span>Instant feedback on every answer · no results page</span>
              </button>
              <button className="mode-btn" onClick={() => pickMode('classic')}>
                <strong>Classic Mode</strong>
                <span>No instant feedback · results summary at the end</span>
              </button>
              <button className="mode-cancel" onClick={() => setPendingDoc(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Active quiz ──────────────────────────────────────────────
  if (state === 'active' && doc) {
    const q = questions[currentIdx]
    const instant = mode === 'loop' || mode === 'instant'
    const answered = isAnswered(q)
    const allAnswered = questions.every(isAnswered)
    const multi = q.multiAnswer
    const remaining = Math.max(0, pool.length - questions.length)

    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <button className="leave-btn" onClick={leaveQuiz}>← Leave</button>
          <span className="quiz-progress">
            Question {currentIdx + 1} of {questions.length}
            {mode === 'loop' && ` · ${remaining} left`}
          </span>
          <span className="quiz-timer">{formatTime(elapsed)}</span>
        </div>

        <div className="quiz-meta">
          {multi ? <span className="tag tag-multi">Select all that apply</span> : <span className="tag tag-single">Single answer</span>}
          {mode === 'loop' && <span className="tag tag-loop">Loop</span>}
          {mode === 'instant' && <span className="tag tag-instant">Instant</span>}
        </div>

        <div className="quiz-question" dangerouslySetInnerHTML={{ __html: renderRichText(q.question) }} />
        {multi && <div className="quiz-hint">Choose one or more correct options.</div>}

        <div className="quiz-options">
          {q.options.map((opt, i) => {
            const isSelected = !!q.selectedIndices?.includes(i)
            let cls = multi ? 'option-card option-card-check' : 'option-card option-card-radio'
            if (answered && instant) {
              if (q.correctIndices.includes(i)) cls += ' correct'
              else if (isSelected) cls += ' wrong'
            } else if (isSelected) {
              cls += ' selected'
            }
            return (
              <button key={i} className={cls} onClick={() => selectAnswer(i)} disabled={instant && answered}>
                <span className="marker">{multi ? (isSelected ? '☑' : '☐') : (isSelected ? '●' : '○')}</span>
                <span className="label">{LABELS[i]}.</span>{' '}
                <span dangerouslySetInnerHTML={{ __html: renderRichText(opt) }} />
              </button>
            )
          })}
        </div>

        {answered && instant && q.explanation && (
          <div className="preview" style={{ marginBottom: 16 }}>
            <strong>Explanation:</strong>{' '}
            <span dangerouslySetInnerHTML={{ __html: renderRichText(q.explanation) }} />
          </div>
        )}

        <div className="quiz-nav">
          <button className="secondary" onClick={goPrev} disabled={currentIdx === 0}>Previous</button>
          {currentIdx === questions.length - 1 ? (
            mode === 'loop' ? (
              <button disabled={!allAnswered} onClick={advanceLoopNow}>Continue</button>
            ) : mode === 'instant' ? (
              <button disabled={!allAnswered} onClick={() => { stopTimer(); clearRawContentMap(); setState('home') }}>Finish</button>
            ) : (
              <button disabled={!allAnswered} onClick={finishQuiz}>See Results</button>
            )
          ) : (
            <button onClick={goNext}>Next</button>
          )}
        </div>
      </div>
    )
  }

  // ── Results ──────────────────────────────────────────────────
  if (state === 'results' && doc) {
    const correct = questions.filter(q => exactMatch(q)).length
    const total = questions.length
    const pct = Math.round((correct / total) * 100)
    const scoreClass = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad'

    return (
      <div className="quiz-results">
        <h2>{doc.title} — Results</h2>
        <div className={`score-big ${scoreClass}`}>{pct}%</div>
        <div className="results-stats">
          <span>{correct}/{total} correct</span>
          <span>{formatTime(elapsed)} taken</span>
        </div>

        <div className="results-actions">
          <button className="pdf-btn" onClick={() => handleExport('pdf')}>Export PDF</button>
          <button className="secondary" onClick={() => { stopTimer(); clearRawContentMap(); setState('home') }}>Home</button>
        </div>

        <div className="results-breakdown">
          {questions.map((q, i) => {
            const right = exactMatch(q)
            const selectedTxt = q.selectedIndices ? q.selectedIndices.map(i => LABELS[i]).join(', ') : ''
            const answerTxt = q.correctIndices.map(i => LABELS[i]).join(', ')
            const marker = right ? '✅' : '❌'
            const markerColor = right ? 'var(--success)' : 'var(--error)'
            return (
              <div key={i} className="result-card">
                <p className="q-text" dangerouslySetInnerHTML={{ __html: `${i + 1}. ${renderRichText(q.question)}` }} />
                <p className="result-line"><strong>Your Answer(s) ==&gt;</strong> {selectedTxt}</p>
                <p className="result-line"><strong>Correct Answer(s) ==&gt;</strong> {answerTxt}{' '}<span style={{ color: markerColor }}>{marker}</span></p>
                {q.explanation && (
                  <p className="result-expl"><strong>Explanation:</strong>{' '}<span dangerouslySetInnerHTML={{ __html: renderRichText(q.explanation) }} /></p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}