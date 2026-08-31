import katexCss from 'katex/dist/katex.min.css?inline'
import hljsCss from 'highlight.js/styles/github-dark.css?inline'
import type { ExportCss } from './quizExporter'

export function exportAssets(): ExportCss {
  return { katexCss, hljsCss }
}
