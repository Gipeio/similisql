// Shared data types — imported by parser, storage, and all components.
// Column: one field definition. Table: in-memory representation of a .ssql.txt file.
// ParseResult: discriminated union returned by parseFile() (→ parser.ts).

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
