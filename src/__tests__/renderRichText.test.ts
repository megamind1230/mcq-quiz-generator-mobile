import { describe, it, expect } from 'vitest'
import { renderRichText, getRawContent, clearRawContentMap } from '../utils/renderRichText'

describe('renderRichText', () => {
  it('renders display math without corrupting the KaTeX sqrt SVG path', () => {
    const out = renderRichText(String.raw`$$\sigma = \sqrt{\frac{\sum f (X - \bar{X})^2}{\sum f}}$$`)
    expect(out).toContain('<svg')
    expect(out).not.toMatch(/d="[^"]*<br>/)
    expect(out).not.toContain('katex-error')
  })

  it('renders inline math without corrupting the KaTeX sqrt SVG path', () => {
    const out = renderRichText(String.raw`$\sqrt{x}$`)
    expect(out).toContain('<svg')
    expect(out).not.toMatch(/d="[^"]*<br>/)
  })

  it('converts newlines in prose to <br>', () => {
    expect(renderRichText('line one\nline two')).toBe('line one<br>line two')
  })

  it('keeps raw newlines inside fenced code blocks', () => {
    const out = renderRichText('```js\nconst a = 1\nconst b = 2\n```')
    expect(out).toMatch(/code-block[\s\S]*\n[\s\S]*<\/code>/)
    expect(out).not.toContain('<br>')
  })

  it('escapes HTML outside of held content', () => {
    expect(renderRichText('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })

  it('stores raw code for the copy handler', () => {
    clearRawContentMap()
    const out = renderRichText('`const x = 1`')
    const id = out.match(/data-copy-id="(rc\d+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(getRawContent(id!)).toBe('const x = 1')
  })
})
