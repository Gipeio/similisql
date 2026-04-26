// Renders the active table. FK cell values are clickable links — clicking calls onFkClick,
// which App.tsx resolves by switching tabs and setting highlight → this component scrolls there.
// Row edit/delete actions appear on hover only to keep the view uncluttered.

import { useEffect, useRef, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { Table as TableData } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-[rgba(74,88,48,0.12)] text-[#4A5830] border-[rgba(74,88,48,0.25)]',
  int:    'bg-[rgba(212,105,42,0.12)] text-[#D4692A] border-[rgba(212,105,42,0.25)]',
  float:  'bg-[rgba(212,105,42,0.08)] text-[#D4692A] border-[rgba(212,105,42,0.20)]',
  bool:   'bg-[rgba(200,64,32,0.12)] text-[#C84020] border-[rgba(200,64,32,0.25)]',
  date:   'bg-[rgba(154,120,72,0.12)] text-[#9A7848] border-[rgba(154,120,72,0.25)]',
}

interface Props {
  table: TableData
  highlightRowIndex?: number | null
  onEditRow: (index: number) => void
  onDeleteRow: (index: number) => void
  onFkClick: (fkTable: string, fkColumn: string, value: string) => void
}

export function TableView({ table, highlightRowIndex, onEditRow, onDeleteRow, onFkClick }: Props) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const highlightRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (highlightRowIndex != null && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightRowIndex])

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10" />
            {table.columns.map(col => (
              <TableHead key={col.name} className="font-mono text-xs py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{col.name}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${TYPE_COLORS[col.type]}`}>
                    {col.type}
                  </Badge>
                  {col.fk && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-[rgba(34,34,32,0.08)] text-[#9A7848] border-[rgba(34,34,32,0.18)]">
                      → {col.fk.table}.{col.fk.column}
                    </Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={table.columns.length + 1} className="text-center text-muted-foreground py-12 text-sm">
                No rows yet. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row, i) => {
              const isHighlighted = i === highlightRowIndex
              return (
                <TableRow
                  key={i}
                  ref={isHighlighted ? highlightRef : undefined}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={isHighlighted ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''}
                >
                  <TableCell className="py-2.5 pl-3 pr-1">
                    <div className={`flex items-center gap-0.5 transition-opacity ${hoveredRow === i ? 'opacity-100' : 'opacity-0'}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        tabIndex={-1}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onEditRow(i)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        tabIndex={-1}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteRow(i)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  {table.columns.map(col => (
                    <TableCell key={col.name} className="font-mono text-sm py-2.5">
                      {col.fk && row[col.name] ? (
                        <button
                          onClick={() => onFkClick(col.fk!.table, col.fk!.column, row[col.name])}
                          className="text-primary hover:underline underline-offset-2 font-mono text-sm"
                        >
                          {row[col.name]}
                        </button>
                      ) : row[col.name] ? (
                        row[col.name]
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
