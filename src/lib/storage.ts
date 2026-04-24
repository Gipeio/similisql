import { serializeTable } from './parser'
import type { Table } from './types'

const STORAGE_KEY = 'similisql:table'
const FILENAME_KEY = 'similisql:filename'

export function saveTable(table: Table, filename: string): void {
  localStorage.setItem(STORAGE_KEY, serializeTable(table))
  localStorage.setItem(FILENAME_KEY, filename)
}

export function loadCachedTable(): { content: string; filename: string } | null {
  const content = localStorage.getItem(STORAGE_KEY)
  const filename = localStorage.getItem(FILENAME_KEY)
  if (!content || !filename) return null
  return { content, filename }
}

export function clearCachedTable(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(FILENAME_KEY)
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
