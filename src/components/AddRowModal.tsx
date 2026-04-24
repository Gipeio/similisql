import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Column, Table } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  int: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  float: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  bool: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  date: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

function validateCell(value: string, type: Column['type']): string | null {
  if (value === '') return null
  switch (type) {
    case 'int':
      return /^-?\d+$/.test(value) ? null : 'Must be an integer'
    case 'float':
      return /^-?\d+(\.\d+)?$/.test(value) ? null : 'Must be a number'
    case 'bool':
      return ['true', 'false'].includes(value.toLowerCase()) ? null : 'Must be true or false'
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : 'Must be YYYY-MM-DD'
    default:
      return null
  }
}

interface Props {
  open: boolean
  table: Table
  onClose: () => void
  onAdd: (row: Record<string, string>) => void
}

export function AddRowModal({ open, table, onClose, onAdd }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(table.columns.map(c => [c.name, '']))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    onAdd(values)
    setValues(Object.fromEntries(table.columns.map(c => [c.name, ''])))
    setErrors({})
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add row</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {table.columns.map(col => (
            <div key={col.name} className="space-y-1.5">
              <Label className="flex items-center gap-2 font-mono text-sm">
                {col.name}
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${TYPE_COLORS[col.type]}`}>
                  {col.type}
                </Badge>
              </Label>
              <Input
                value={values[col.name]}
                onChange={e => handleChange(col.name, col.type, e.target.value)}
                placeholder={col.type === 'bool' ? 'true / false' : col.type === 'date' ? 'YYYY-MM-DD' : col.name}
                className={`font-mono text-sm ${errors[col.name] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              {errors[col.name] && (
                <p className="text-xs text-destructive">{errors[col.name]}</p>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Add row</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
