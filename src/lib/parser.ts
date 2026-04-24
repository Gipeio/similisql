import type { Column, ColumnType, ParseResult, Table } from './types'

const SEPARATOR = '|'
const VALID_TYPES: ColumnType[] = ['string', 'int', 'float', 'bool', 'date']

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
