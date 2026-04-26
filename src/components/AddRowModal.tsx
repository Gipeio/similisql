// Form dialog for adding or editing one row, with per-column type validation.
// FK columns render as a <select> (FkSelect) populated from the referenced table in the session.
// Auto-key columns (first int, no FK) are auto-filled on add and shown read-only on edit.

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Column, Table } from '@/lib/types'
import type { Session } from '@/lib/storage'

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-[rgba(74,88,48,0.12)] text-[#4A5830] border-[rgba(74,88,48,0.25)]',
  int:    'bg-[rgba(212,105,42,0.12)] text-[#D4692A] border-[rgba(212,105,42,0.25)]',
  float:  'bg-[rgba(212,105,42,0.08)] text-[#D4692A] border-[rgba(212,105,42,0.20)]',
  bool:   'bg-[rgba(200,64,32,0.12)] text-[#C84020] border-[rgba(200,64,32,0.25)]',
  date:   'bg-[rgba(154,120,72,0.12)] text-[#9A7848] border-[rgba(154,120,72,0.25)]',
}

function validateCell(value: string, type: Column['type']): string | null {
  if (value === '') return null
  switch (type) {
    case 'int':    return /^-?\d+$/.test(value) ? null : 'Must be an integer'
    case 'float':  return /^-?\d+(\.\d+)?$/.test(value) ? null : 'Must be a number'
    case 'bool':   return ['true', 'false'].includes(value.toLowerCase()) ? null : 'Must be true or false'
    case 'date':   return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : 'Must be YYYY-MM-DD'
    default:       return null
  }
}

function resolveRefTable(fkTable: string, session: Session): Table | null {
  const entry = Object.entries(session).find(([fn]) =>
    fn.replace(/\.ssql\.txt$/, '').replace(/\.txt$/, '') === fkTable
  )
  return entry ? entry[1] : null
}

function labelColumn(refTable: Table, fkColumn: string): string | null {
  return refTable.columns.find(c => c.type === 'string' && !c.fk && c.name !== fkColumn)?.name ?? null
}

interface FkSelectProps {
  col: Column & { fk: NonNullable<Column['fk']> }
  session: Session
  value: string
  onChange: (v: string) => void
}

function FkSelect({ col, session, value, onChange }: FkSelectProps) {
  const refTable = resolveRefTable(col.fk.table, session)
  if (!refTable) {
    return (
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`${col.fk.table} not loaded`}
        className="font-mono text-sm"
      />
    )
  }
  const labelCol = labelColumn(refTable, col.fk.column)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="">—</option>
      {refTable.rows.map((row, i) => {
        const id = row[col.fk.column] ?? ''
        const label = labelCol ? row[labelCol] : null
        return (
          <option key={i} value={id}>
            {id}{label ? ` — ${label}` : ''}
          </option>
        )
      })}
    </select>
  )
}

interface Props {
  open: boolean
  table: Table
  session: Session
  autoKeyName: string | null
  onClose: () => void
  onSubmit: (row: Record<string, string>) => void
  initialValues?: Record<string, string>
  mode?: 'add' | 'edit'
}

export function AddRowModal({ open, table, session, autoKeyName, onClose, onSubmit, initialValues, mode = 'add' }: Props) {
  const empty = () => Object.fromEntries(table.columns.map(c => [c.name, '']))
  const [values, setValues] = useState<Record<string, string>>(empty)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? empty())
      setErrors({})
    }
  }, [open])

  function handleChange(name: string, type: Column['type'], value: string) {
    setValues(v => ({ ...v, [name]: value }))
    const err = validateCell(value, type)
    setErrors(e => ({ ...e, [name]: err ?? '' }))
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {}
    let valid = true
    for (const col of table.columns) {
      const err = validateCell(values[col.name], col.type)
      if (err) { newErrors[col.name] = err; valid = false }
    }
    if (!valid) { setErrors(newErrors); return }
    onSubmit(values)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{mode === 'edit' ? 'Edit row' : 'Add row'}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-4 py-2 pr-1">
          {table.columns.filter(col => mode === 'add' ? col.name !== autoKeyName : true).map(col => (
            <div key={col.name} className="space-y-1.5">
              <Label className="flex items-center gap-2 font-mono text-sm">
                {col.name}
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${TYPE_COLORS[col.type]}`}>
                  {col.type}
                </Badge>
                {col.fk && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-rose-500/10 text-rose-400 border-rose-500/20">
                    → {col.fk.table}.{col.fk.column}
                  </Badge>
                )}
              </Label>
              {col.name === autoKeyName ? (
                <Input
                  value={initialValues?.[col.name] ?? ''}
                  disabled
                  className="font-mono text-sm opacity-50"
                />
              ) : col.fk ? (
                <FkSelect
                  col={col as Column & { fk: NonNullable<Column['fk']> }}
                  session={session}
                  value={values[col.name] ?? ''}
                  onChange={v => handleChange(col.name, col.type, v)}
                />
              ) : (
                <Input
                  value={values[col.name] ?? ''}
                  onChange={e => handleChange(col.name, col.type, e.target.value)}
                  placeholder={col.type === 'bool' ? 'true / false' : col.type === 'date' ? 'YYYY-MM-DD' : col.name}
                  className={`font-mono text-sm ${errors[col.name] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              )}
              {errors[col.name] && <p className="text-xs text-destructive">{errors[col.name]}</p>}
            </div>
          ))}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{mode === 'edit' ? 'Save' : 'Add row'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
