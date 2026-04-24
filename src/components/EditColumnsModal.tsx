import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'
import type { Column, ColumnType, Table } from '@/lib/types'

const TYPES: ColumnType[] = ['string', 'int', 'float', 'bool', 'date']

const TYPE_VALIDATORS: Record<ColumnType, (v: string) => boolean> = {
  string: () => true,
  int: v => /^-?\d+$/.test(v),
  float: v => /^-?\d+(\.\d+)?$/.test(v),
  bool: v => ['true', 'false'].includes(v.toLowerCase()),
  date: v => /^\d{4}-\d{2}-\d{2}$/.test(v),
}

interface EditCol {
  _id: string
  originalName: string | null
  name: string
  type: ColumnType
  fkRaw: string
}

function toEditCol(col: Column, i: number): EditCol {
  return {
    _id: `existing-${i}`,
    originalName: col.name,
    name: col.name,
    type: col.type,
    fkRaw: col.fk ? `${col.fk.table}.${col.fk.column}` : '',
  }
}

function parseFk(raw: string): Column['fk'] | undefined {
  const parts = raw.trim().split('.')
  if (parts.length === 2 && parts[0] && parts[1]) return { table: parts[0], column: parts[1] }
  return undefined
}

interface Props {
  open: boolean
  table: Table
  onClose: () => void
  onApply: (columns: Column[], rows: Record<string, string>[]) => void
}

export function EditColumnsModal({ open, table, onClose, onApply }: Props) {
  const [cols, setCols] = useState<EditCol[]>(() => table.columns.map(toEditCol))
  const [errors, setErrors] = useState<Record<string, string>>({})

  function reset() {
    setCols(table.columns.map(toEditCol))
    setErrors({})
  }

  function handleClose() {
    reset()
    onClose()
  }

  function update(id: string, patch: Partial<EditCol>) {
    setCols(prev => prev.map(c => c._id === id ? { ...c, ...patch } : c))
    setErrors(prev => { const e = { ...prev }; delete e[id]; return e })
  }

  function addCol() {
    const id = `new-${Date.now()}`
    setCols(prev => [...prev, { _id: id, originalName: null, name: '', type: 'string', fkRaw: '' }])
  }

  function removeCol(id: string) {
    setCols(prev => prev.filter(c => c._id !== id))
    setErrors(prev => { const e = { ...prev }; delete e[id]; return e })
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {}
    const names = new Set<string>()

    for (const col of cols) {
      if (!col.name.trim()) {
        newErrors[col._id] = 'Name is required'
        continue
      }
      if (names.has(col.name)) {
        newErrors[col._id] = 'Duplicate column name'
        continue
      }
      names.add(col.name)

      if (col.fkRaw.trim() && !parseFk(col.fkRaw)) {
        newErrors[col._id] = 'FK must be table.column'
        continue
      }

      if (col.originalName && col.originalName !== col.name || col.originalName && col.type !== table.columns.find(c => c.name === col.originalName)?.type) {
        const originalType = table.columns.find(c => c.name === col.originalName)?.type
        if (originalType && originalType !== col.type) {
          const validator = TYPE_VALIDATORS[col.type]
          const conflicting = table.rows
            .map(r => r[col.originalName!])
            .filter(v => v !== '' && v !== undefined)
            .find(v => !validator(v))
          if (conflicting) {
            newErrors[col._id] = `Value "${conflicting}" is incompatible with type ${col.type}`
          }
        }
      }
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      return
    }

    const newColumns: Column[] = cols.map(c => ({
      name: c.name.trim(),
      type: c.type,
      ...(parseFk(c.fkRaw) ? { fk: parseFk(c.fkRaw) } : {}),
    }))

    const newRows = table.rows.map(row => {
      const newRow: Record<string, string> = {}
      for (const col of cols) {
        newRow[col.name.trim()] = col.originalName ? (row[col.originalName] ?? '') : ''
      }
      return newRow
    })

    onApply(newColumns, newRows)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit columns</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-3 py-2 pr-1">
          {cols.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No columns yet. Add one below.</p>
          )}

          {cols.map(col => (
            <div key={col._id} className="space-y-1.5 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={col.name}
                    onChange={e => update(col._id, { name: e.target.value })}
                    placeholder="column_name"
                    className="font-mono text-sm h-8"
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <select
                    value={col.type}
                    onChange={e => update(col._id, { type: e.target.value as ColumnType })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCol(col._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Foreign key <span className="opacity-50">(optional — table.column)</span></Label>
                <Input
                  value={col.fkRaw}
                  onChange={e => update(col._id, { fkRaw: e.target.value })}
                  placeholder="other_table.id"
                  className="font-mono text-sm h-8"
                />
              </div>

              {errors[col._id] && (
                <p className="text-xs text-destructive">{errors[col._id]}</p>
              )}
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full" onClick={addCol}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add column
          </Button>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
