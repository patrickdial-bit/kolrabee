// Minimal, safe Markdown → HTML for knowledge-base articles. Article bodies are
// authored by the super admin (trusted), but we still escape ALL input first
// and only then apply a small, fixed set of formatting rules — so even a stray
// angle bracket can't inject markup. Supports: #/##/### headings, - bullet
// lists, 1. ordered lists, **bold**, `code`, [text](url) links, and paragraphs.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inline(escaped: string): string {
  // Operates on already-escaped text.
  let out = escaped
  // Links [text](http...) — only http/https/mailto to avoid javascript: URLs.
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_m, text, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-ember underline hover:text-primary-700">${text}</a>`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-[0.85em]">$1</code>')
  return out
}

export function renderMarkdown(md: string): string {
  const lines = escapeHtml(md ?? '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let para: string[] = []

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushPara()
      closeList()
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushPara()
      closeList()
      const level = heading[1].length
      const sizes = { 1: 'text-xl font-bold mt-6 mb-2', 2: 'text-lg font-semibold mt-5 mb-2', 3: 'text-base font-semibold mt-4 mb-1' } as const
      html.push(`<h${level + 1} class="${sizes[level as 1 | 2 | 3]} text-gray-900">${inline(heading[2])}</h${level + 1}>`)
      continue
    }
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      flushPara()
      if (listType !== 'ul') { closeList(); html.push('<ul class="list-disc pl-6 space-y-1">'); listType = 'ul' }
      html.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }
    const ordered = line.match(/^\d+\.\s+(.*)$/)
    if (ordered) {
      flushPara()
      if (listType !== 'ol') { closeList(); html.push('<ol class="list-decimal pl-6 space-y-1">'); listType = 'ol' }
      html.push(`<li>${inline(ordered[1])}</li>`)
      continue
    }
    closeList()
    para.push(line.trim())
  }
  flushPara()
  closeList()
  return html.join('\n')
}

// Turn a search headline (escaped text with «/» markers around matches) into
// safe highlighted HTML: escape everything, then swap the markers for <mark>.
export function renderHeadline(headline: string): string {
  return escapeHtml(headline ?? '')
    .replace(/«/g, '<mark class="bg-yellow-200 rounded px-0.5">')
    .replace(/»/g, '</mark>')
}
