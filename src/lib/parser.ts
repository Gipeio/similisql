// Converts between the .ssql.txt plain-text format and in-memory Table objects (→ types.ts).
// parseFile()      — text → ParseResult; called by loadIntoSession (App.tsx) and loadSession (storage.ts).
// serializeTable() — Table → text; called before every save or export.

import type { Column, ColumnType, ParseResult, Table } from './types'

const SEPARATOR = '|'
const VALID_TYPES: ColumnType[] = ['string', 'int', 'float', 'bool', 'date']

// Column def format: "name:type" or "name:type:fk:othertable.column"
function parseColumnDef(raw: string): Column | null {
  const parts = raw.trim().split(':')
  if (parts.length < 2) return null

  const name = parts[0].trim()
  const type = parts[1].trim() as ColumnType

  if (!name || !VALID_TYPES.includes(type)) return null

  let fk: Column['fk'] | undefined
  if (parts.length === 4 && parts[2].trim() === 'fk') {
    const [table, column] = parts[3].trim().split('.')
    if (table && column) fk = { table, column }
  }

  return { name, type, ...(fk ? { fk } : {}) }
}

export function parseFile(content: string): ParseResult {
  const trimmed = content.trim()
  if (!trimmed) return { status: 'empty' }

  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { status: 'empty' }

  const headerParts = lines[0].split(SEPARATOR)
  if (headerParts.length === 0) {
    return { status: 'invalid', error: 'Header line is empty.' }
  }

  const columns: Column[] = []
  for (const part of headerParts) {
    const col = parseColumnDef(part)
    if (!col) {
      return {
        status: 'invalid',
        error: `Invalid column definition: "${part}". Expected format: name:type or name:type:fk:table.column`,
      }
    }
    columns.push(col)
  }

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(SEPARATOR)
    if (cells.length !== columns.length) {
      return {
        status: 'invalid',
        error: `Row ${i} has ${cells.length} value(s) but header defines ${columns.length} column(s).`,
      }
    }
    const row: Record<string, string> = {}
    columns.forEach((col, idx) => {
      row[col.name] = cells[idx].trim()
    })
    rows.push(row)
  }

  // Auto-key rule: first int column with no FK must have unique, valid integer values.
  // App.tsx uses this column to auto-increment IDs when adding rows.
  const keyCol = columns[0]
  if (keyCol && keyCol.type === 'int' && !keyCol.fk) {
    const seen = new Set<string>()
    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][keyCol.name]
      if (!val) continue
      if (!/^-?\d+$/.test(val)) {
        return { status: 'invalid', error: `Row ${i + 1}: "${keyCol.name}" must be an integer, got "${val}".` }
      }
      if (seen.has(val)) {
        return { status: 'invalid', error: `Duplicate "${keyCol.name}" value: ${val}.` }
      }
      seen.add(val)
    }
  }

  return { status: 'valid', table: { columns, rows } }
}

export function serializeTable(table: Table): string {
  const header = table.columns
    .map(col => {
      const base = `${col.name}:${col.type}`
      return col.fk ? `${base}:fk:${col.fk.table}.${col.fk.column}` : base
    })
    .join(SEPARATOR)

  const rows = table.rows.map(row =>
    table.columns.map(col => row[col.name] ?? '').join(SEPARATOR)
  )

  return [header, ...rows].join('\n')
}
