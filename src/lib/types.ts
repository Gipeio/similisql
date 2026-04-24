export type ColumnType = 'string' | 'int' | 'float' | 'bool' | 'date'

export interface Column {
  name: string
  type: ColumnType
  fk?: { table: string; column: string }
}

export interface Table {
  columns: Column[]
  rows: Record<string, string>[]
}

export type ParseResult =
  | { status: 'empty' }
  | { status: 'valid'; table: Table }
  | { status: 'invalid'; error: string }
