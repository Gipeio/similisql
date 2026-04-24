import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Table as TableData } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  int: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  float: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  bool: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  date: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

interface Props {
  table: TableData
}

export function TableView({ table }: Props) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {table.columns.map(col => (
              <TableHead key={col.name} className="font-mono text-xs py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{col.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 font-mono ${TYPE_COLORS[col.type]}`}
                  >
                    {col.type}
                  </Badge>
                  {col.fk && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-rose-500/10 text-rose-400 border-rose-500/20">
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
              <TableCell
                colSpan={table.columns.length}
                className="text-center text-muted-foreground py-12 text-sm"
              >
                No rows yet. Add one to get started.
              </TableCell>
            </TableRow>
          ) : (
            table.rows.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/20">
                {table.columns.map(col => (
                  <TableCell key={col.name} className="font-mono text-sm py-2.5">
                    {row[col.name] ?? <span className="text-muted-foreground italic">—</span>}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
