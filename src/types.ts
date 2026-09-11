export interface McqQuestion {
  question: string
  options: string[]
  correctIndices: number[]
  multiAnswer: boolean
  explanation?: string
  selectedIndices?: number[] // transient, during quiz
}

export interface McqDocument {
  title: string
  source: string
  generated: string
  questions: McqQuestion[]
}

export interface QuizResult {
  timestamp: string
  title: string
  source: string
  totalQuestions: number
  correctAnswers: number
  timeTakenSeconds: number
}

export interface AppSettings {
  theme: 'light' | 'dark'
  randomizeOptions: boolean
  randomizeQuestionOrder: boolean
}
