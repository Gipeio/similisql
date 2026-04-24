import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus, GripVertical, Lock } from 'lucide-react'
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
    _id: `col-${i}`,
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

// First column + consecutive FK columns following it are locked
function computeLockedCount(cols: EditCol[]): number {
  if (cols.length === 0) return 0
  let count = 1
  while (count < cols.length && cols[count].fkRaw.trim()) count++
  return count
}

interface CardProps {
  col: EditCol
  locked: boolean
  error?: string
  onChange: (patch: Partial<EditCol>) => void
  onRemove: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  dragRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
}

function ColumnCard({ col, locked, error, onChange, onRemove, dragHandleProps, dragRef, style }: CardProps) {
  return (
    <div
      ref={dragRef as React.Ref<HTMLDivElement>}
      style={style}
      className={`space-y-1.5 rounded-lg border p-3 bg-card ${locked ? 'border-border/50 opacity-75' : 'border-border'}`}
    >
      <div className="flex gap-2 items-start">
        <div className="mt-7 shrink-0">
          {locked ? (
            <Lock className="w-4 h-4 text-muted-foreground/40" />
          ) : (
            <span
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            >
              <GripVertical className="w-4 h-4" />
            </span>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={col.name}
            onChange={e => onChange({ name: e.target.value })}
            placeholder="column_name"
            className="font-mono text-sm h-8"
          />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <select
            value={col.type}
            onChange={e => onChange({ type: e.target.value as ColumnType })}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {!locked && (
          <div className="mt-7 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1 pl-6">
        <Label className="text-xs text-muted-foreground">
          Foreign key <span className="opacity-50">(optional — table.column)</span>
        </Label>
        <Input
          value={col.fkRaw}
          onChange={e => onChange({ fkRaw: e.target.value })}
          placeholder="other_table.id"
          className="font-mono text-sm h-8"
          disabled={locked}
        />
      </div>

      {error && <p className="text-xs text-destructive pl-6">{error}</p>}
    </div>
  )
}

function SortableCard(props: Omit<CardProps, 'dragHandleProps' | 'dragRef' | 'style'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.col._id })
  return (
    <ColumnCard
      {...props}
      dragRef={setNodeRef}
      dragHandleProps={{ ...attributes, ...listeners }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
    />
  )
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

  useEffect(() => {
    if (open) {
      setCols(table.columns.map(toEditCol))
      setErrors({})
    }
  }, [open])

  const lockedCount = useMemo(() => computeLockedCount(cols), [cols.slice(0, cols.length).map(c => c.fkRaw).join('|')])
  const lockedCols = cols.slice(0, lockedCount)
  const freeCols = cols.slice(lockedCount)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = freeCols.findIndex(c => c._id === active.id)
    const newIdx = freeCols.findIndex(c => c._id === over.id)
    setCols([...lockedCols, ...arrayMove(freeCols, oldIdx, newIdx)])
  }

  function updateCol(id: string, patch: Partial<EditCol>) {
    setCols(prev => prev.map(c => c._id === id ? { ...c, ...patch } : c))
    setErrors(prev => { const e = { ...prev }; delete e[id]; return e })
  }

  function removeCol(id: string) {
    setCols(prev => prev.filter(c => c._id !== id))
    setErrors(prev => { const e = { ...prev }; delete e[id]; return e })
  }

  function addCol() {
    const id = `new-${Date.now()}`
    setCols(prev => [...prev, { _id: id, originalName: null, name: '', type: 'string', fkRaw: '' }])
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {}
    const names = new Set<string>()

    for (const col of cols) {
      if (!col.name.trim()) { newErrors[col._id] = 'Name is required'; continue }
      if (names.has(col.name.trim())) { newErrors[col._id] = 'Duplicate column name'; continue }
      names.add(col.name.trim())
      if (col.fkRaw.trim() && !parseFk(col.fkRaw)) { newErrors[col._id] = 'FK must be table.column'; continue }

      if (col.originalName) {
        const originalType = table.columns.find(c => c.name === col.originalName)?.type
        if (originalType && originalType !== col.type) {
          const validator = TYPE_VALIDATORS[col.type]
          const conflicting = table.rows
            .map(r => r[col.originalName!])
            .filter(v => v !== '' && v !== undefined)
            .find(v => !validator(v))
          if (conflicting) newErrors[col._id] = `"${conflicting}" is incompatible with type ${col.type}`
        }
      }
    }

    if (Object.keys(newErrors).length) { setErrors(newErrors); return }

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
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit columns</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-2 py-2 pr-1">
          {lockedCols.map(col => (
            <ColumnCard
              key={col._id}
              col={col}
              locked
              error={errors[col._id]}
              onChange={patch => updateCol(col._id, patch)}
              onRemove={() => {}}
            />
          ))}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={freeCols.map(c => c._id)} strategy={verticalListSortingStrategy}>
              {freeCols.map(col => (
                <SortableCard
                  key={col._id}
                  col={col}
                  locked={false}
                  error={errors[col._id]}
                  onChange={patch => updateCol(col._id, patch)}
                  onRemove={() => removeCol(col._id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {cols.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No columns yet. Add one below.</p>
          )}

          <Button variant="outline" size="sm" className="w-full" onClick={addCol}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add column
          </Button>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
