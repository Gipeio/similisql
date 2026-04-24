import { parseFile, serializeTable } from './parser'
import type { Table } from './types'

export type Session = Record<string, Table>

const SESSION_KEY = 'similisql:session'

export function saveSession(session: Session): void {
  const data: Record<string, string> = {}
  for (const [filename, table] of Object.entries(session)) {
    data[filename] = table.columns.length === 0 ? '' : serializeTable(table)
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export function loadSession(): Session {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return {}
  try {
    const data = JSON.parse(raw) as Record<string, string>
    const session: Session = {}
    for (const [filename, content] of Object.entries(data)) {
      if (!content) { session[filename] = { columns: [], rows: [] }; continue }
      const result = parseFile(content)
      if (result.status === 'valid') session[filename] = result.table
    }
    return session
  } catch {
    return {}
  }
}

export function exportTable(table: Table, filename: string): void {
  const content = serializeTable(table)
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
