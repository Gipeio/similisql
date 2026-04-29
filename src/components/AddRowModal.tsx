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
  string: 'bg-[rgba(58,80,32,0.15)] text-[#3A5020] border-[rgba(58,80,32,0.40)] dark:bg-[rgba(74,88,48,0.22)] dark:text-[#8AA870] dark:border-[rgba(74,88,48,0.40)]',
  int:    'bg-[rgba(139,26,16,0.12)] text-[#8B1A10] border-[rgba(139,26,16,0.35)] dark:bg-[rgba(139,26,16,0.22)] dark:text-[#D46050] dark:border-[rgba(139,26,16,0.40)]',
  float:  'bg-[rgba(139,26,16,0.07)] text-[#7A2018] border-[rgba(139,26,16,0.22)] dark:bg-[rgba(139,26,16,0.14)] dark:text-[#B85040] dark:border-[rgba(139,26,16,0.30)]',
  bool:   'bg-[rgba(139,26,16,0.12)] text-[#8B1A10] border-[rgba(139,26,16,0.35)] dark:bg-[rgba(139,26,16,0.22)] dark:text-[#D46050] dark:border-[rgba(139,26,16,0.40)]',
  date:   'bg-[rgba(26,18,8,0.10)] text-[#5A5038] border-[rgba(26,18,8,0.25)] dark:bg-[rgba(212,216,176,0.08)] dark:text-[#8AA870] dark:border-[rgba(212,216,176,0.18)]',
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

const LCD_PROMPT_STYLE = { fontFamily: 'var(--font-pixel)' } as const
const LCD_PROMPT_CLS = 'px-2.5 text-[7px] text-muted-foreground group-focus-within:text-foreground/60 select-none flex-shrink-0 transition-colors'
const LCD_WRAPPER_CLS = 'group flex items-center h-9 border border-border focus-within:border-foreground/40 rounded-[var(--radius)] bg-background overflow-hidden transition-colors'
const LCD_INPUT_CLS = 'border-0 focus-visible:border-0 focus-visible:ring-0 rounded-none h-full bg-transparent px-0 pr-2.5 flex-1 min-w-0 font-mono text-sm'

function FkSelect({ col, session, value, onChange }: FkSelectProps) {
  const refTable = resolveRefTable(col.fk.table, session)
  if (!refTable) {
    return (
      <div className={LCD_WRAPPER_CLS}>
        <span className={LCD_PROMPT_CLS} style={LCD_PROMPT_STYLE}>{'>'}</span>
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`${col.fk.table} not loaded`}
          className={LCD_INPUT_CLS}
        />
      </div>
    )
  }
  const labelCol = labelColumn(refTable, col.fk.column)
  return (
    <div className={LCD_WRAPPER_CLS}>
      <span className={LCD_PROMPT_CLS} style={LCD_PROMPT_STYLE}>{'>'}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-full flex-1 bg-transparent text-sm font-mono px-0 pr-3 border-0 outline-none"
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
    </div>
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
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-[rgba(26,18,8,0.08)] text-[#5A5038] border-[rgba(26,18,8,0.22)] dark:bg-[rgba(212,216,176,0.07)] dark:text-[#8AA870] dark:border-[rgba(212,216,176,0.16)]">
                    → {col.fk.table}.{col.fk.column}
                  </Badge>
                )}
              </Label>
              {col.name === autoKeyName ? (
                <div className={`${LCD_WRAPPER_CLS} opacity-50`}>
                  <span className={LCD_PROMPT_CLS} style={LCD_PROMPT_STYLE}>{'>'}</span>
                  <Input value={initialValues?.[col.name] ?? ''} disabled className={LCD_INPUT_CLS} />
                </div>
              ) : col.fk ? (
                <FkSelect
                  col={col as Column & { fk: NonNullable<Column['fk']> }}
                  session={session}
                  value={values[col.name] ?? ''}
                  onChange={v => handleChange(col.name, col.type, v)}
                />
              ) : (
                <div className={`group flex items-center h-9 border rounded-[var(--radius)] bg-background overflow-hidden transition-colors ${errors[col.name] ? 'border-destructive' : 'border-border focus-within:border-foreground/40'}`}>
                  <span className={LCD_PROMPT_CLS} style={LCD_PROMPT_STYLE}>{'>'}</span>
                  <Input
                    value={values[col.name] ?? ''}
                    onChange={e => handleChange(col.name, col.type, e.target.value)}
                    placeholder={col.type === 'bool' ? 'true / false' : col.type === 'date' ? 'YYYY-MM-DD' : col.name}
                    className={`${LCD_INPUT_CLS} ${errors[col.name] ? 'focus-visible:ring-0' : ''}`}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
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
