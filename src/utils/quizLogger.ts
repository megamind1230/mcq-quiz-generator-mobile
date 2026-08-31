import type { QuizResult } from '../types'

const RESULTS_FILE = 'quiz-results.json'

export function logQuizResult(result: QuizResult): void {
  const existing = loadQuizResults()
  existing.push(result)
  localStorage.setItem(RESULTS_FILE, JSON.stringify(existing))
}

export function loadQuizResults(): QuizResult[] {
  try {
    const raw = localStorage.getItem(RESULTS_FILE)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

export function clearQuizResults(): void {
  localStorage.removeItem(RESULTS_FILE)
}
