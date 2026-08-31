import { describe, it, expect } from 'vitest'
import { parseMcqFile, parseAnswerList } from '../utils/mcqParser'

describe('parseAnswerList', () => {
  it('parses a single index', () => {
    expect(parseAnswerList('B')).toEqual([1])
  })
  it('parses a multi list in any case/space', () => {
    expect(parseAnswerList('A,C')).toEqual([0, 2])
    expect(parseAnswerList('a, d')).toEqual([0, 3])
  })
  it('ignores invalid letters', () => {
    expect(parseAnswerList('E,Z')).toEqual([])
  })
})

describe('parseMcqFile', () => {
  it('parses single-answer questions', () => {
    const input = `---
title: Test Quiz
source: test.md
generated: 2026-07-20
---

## Question 1
What is 2 + 2?

A. 3
B. 4
C. 5
D. 6

**[Answer: B]**
**Explanation:** Basic arithmetic.

---

## Question 2
Capital of France?

A. London
B. Berlin
C. Paris
D. Madrid

**[Answer: C]**
`
    const result = parseMcqFile(input)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Test Quiz')
    expect(result!.source).toBe('test.md')
    expect(result!.generated).toBe('2026-07-20')
    expect(result!.questions).toHaveLength(2)
    expect(result!.questions[0].correctIndices).toEqual([1])
    expect(result!.questions[0].multiAnswer).toBe(false)
    expect(result!.questions[0].explanation).toBe('Basic arithmetic.')
    expect(result!.questions[1].correctIndices).toEqual([2])
    expect(result!.questions[1].multiAnswer).toBe(false)
  })

  it('parses multi-answer questions', () => {
    const input = `---
title: Multi Quiz
source: multi.md
---

## Question 1
Select prime numbers

A. 2
B. 4
C. 5
D. 9

**[Answer:A,C]**
`
    const result = parseMcqFile(input)
    expect(result).not.toBeNull()
    expect(result!.questions[0].correctIndices).toEqual([0, 2])
    expect(result!.questions[0].multiAnswer).toBe(true)
  })

  it('rejects input without any valid question', () => {
    expect(parseMcqFile('nothing here')).toBeNull()
    expect(parseMcqFile('')).toBeNull()
  })
})
