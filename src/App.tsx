import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Download, FolderOpen, Database, Columns3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { FileDropZone } from '@/components/FileDropZone'
import { TableView } from '@/components/TableView'
import { AddRowModal } from '@/components/AddRowModal'
import { EditColumnsModal } from '@/components/EditColumnsModal'
import { OverwriteWarningModal } from '@/components/OverwriteWarningModal'
import { parseFile } from '@/lib/parser'
import { saveSession, loadSession, exportTable, type Session } from '@/lib/storage'
import type { Column, Table } from '@/lib/types'

function tabLabel(filename: string) {
  return filename.replace(/\.ssql\.txt$/, '').replace(/\.txt$/, '')
}

function resolveFilenameByTableName(name: string, session: Session): string | null {
  return Object.keys(session).find(fn => tabLabel(fn) === name) ?? null
}

export default function App() {
  const [session, setSession] = useState<Session>({})
  const [activeFilename, setActiveFilename] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)

  const [rowModal, setRowModal] = useState<{ open: boolean; editIndex: number | null }>({ open: false, editIndex: null })
  const [editColumnsOpen, setEditColumnsOpen] = useState(false)
  const [replaceWarning, setReplaceWarning] = useState<{ content: string; filename: string } | null>(null)
  const [closeWarning, setCloseWarning] = useState<string | null>(null)

  const addTableRef = useRef<HTMLInputElement>(null)

  const activeTable = activeFilename ? session[activeFilename] ?? null : null

  useEffect(() => {
    const saved = loadSession()
    if (Object.keys(saved).length > 0) {
      setSession(saved)
      setActiveFilename(Object.keys(saved)[0])
    }
  }, [])

  useEffect(() => {
    if (highlight !== null) {
      const t = setTimeout(() => setHighlight(null), 2500)
      return () => clearTimeout(t)
    }
  }, [highlight])

  function updateSession(next: Session) {
    setSession(next)
    saveSession(next)
  }

  function readFile(file: File, onLoad: (content: string, name: string) => void) {
    const reader = new FileReader()
    reader.onload = e => onLoad(e.target?.result as string, file.name)
    reader.readAsText(file)
  }

  function loadIntoSession(content: string, filename: string, replace = false) {
    if (!replace && filename in session) {
      setReplaceWarning({ content, filename })
      return
    }
    const result = parseFile(content)
    if (result.status === 'invalid') { toast.error(result.error); return }
    const table: Table = result.status === 'empty' ? { columns: [], rows: [] } : result.table
    const next = { ...session, [filename]: table }
    updateSession(next)
    setActiveFilename(filename)
    if (result.status === 'empty') toast.info('Empty file — define columns to get started.')
    else toast.success(`Loaded ${result.table.rows.length} row(s)`)
  }

  function confirmRemoveTable(filename: string) {
    setCloseWarning(filename)
  }

  function handleRemoveTable(filename: string) {
    const next = { ...session }
    delete next[filename]
    updateSession(next)
    if (activeFilename === filename) {
      const keys = Object.keys(next)
      setActiveFilename(keys.length > 0 ? keys[0] : null)
    }
    setCloseWarning(null)
  }

  function handleTabClick(filename: string) {
    setActiveFilename(filename)
    setHighlight(null)
  }

  function handleFkClick(fkTable: string, fkColumn: string, value: string) {
    const targetFilename = resolveFilenameByTableName(fkTable, session)
    if (!targetFilename) {
      toast.error(`Table "${fkTable}" is not loaded`)
      return
    }
    const targetTable = session[targetFilename]
    const rowIndex = targetTable.rows.findIndex(r => r[fkColumn] === value)
    setActiveFilename(targetFilename)
    setHighlight(rowIndex >= 0 ? rowIndex : null)
    if (rowIndex < 0) toast.info(`No matching row found in ${tabLabel(targetFilename)}`)
  }

  function handleRowSubmit(row: Record<string, string>) {
    if (!activeTable || !activeFilename) return
    const rows = rowModal.editIndex !== null
      ? activeTable.rows.map((r, i) => i === rowModal.editIndex ? row : r)
      : [...activeTable.rows, row]
    const next = { ...session, [activeFilename]: { ...activeTable, rows } }
    updateSession(next)
    toast.success(rowModal.editIndex !== null ? 'Row updated' : 'Row added')
  }

  function handleColumnsApply(columns: Column[], rows: Record<string, string>[]) {
    if (!activeFilename) return
    const next = { ...session, [activeFilename]: { columns, rows } }
    updateSession(next)
    toast.success('Columns updated')
  }

  function handleExport() {
    if (!activeTable || !activeFilename) return
    exportTable(activeTable, activeFilename)
    toast.success('File downloaded')
  }

  const filenames = Object.keys(session)
  const isEmpty = filenames.length === 0

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <span className="font-mono font-semibold tracking-tight text-lg">similisql</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {filenames.map(fn => (
            <div
              key={fn}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono shrink-0 cursor-pointer transition-colors ${
                fn === activeFilename
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              onClick={() => handleTabClick(fn)}
            >
              <span>{tabLabel(fn)}</span>
              <button
                onClick={e => { e.stopPropagation(); confirmRemoveTable(fn) }}
                className="opacity-50 hover:opacity-100 transition-opacity rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => addTableRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
          <input
            ref={addTableRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              readFile(file, loadIntoSession)
              e.target.value = ''
            }}
          />
        </div>

        {/* Actions */}
        {activeTable && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditColumnsOpen(true)}>
              <Columns3 className="w-4 h-4 mr-1.5" />
              Edit columns
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
            <Button size="sm" onClick={() => setRowModal({ open: true, editIndex: null })}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add row
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Open a file</h1>
              <p className="text-muted-foreground text-sm">
                Drop a <span className="font-mono">.ssql.txt</span> file or click the <span className="font-mono">+</span> tab to get started
              </p>
            </div>
            <FileDropZone onFile={(content, name) => loadIntoSession(content, name)} />
          </div>
        ) : activeTable?.columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <p className="text-muted-foreground text-sm">Empty file — define columns to get started.</p>
            <Button onClick={() => setEditColumnsOpen(true)}>
              <Columns3 className="w-4 h-4 mr-1.5" />
              Define columns
            </Button>
          </div>
        ) : activeTable ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              {activeTable.rows.length} row{activeTable.rows.length !== 1 ? 's' : ''} · {activeTable.columns.length} column{activeTable.columns.length !== 1 ? 's' : ''}
            </p>
            <TableView
              table={activeTable}
              highlightRowIndex={highlight}
              onEditRow={i => setRowModal({ open: true, editIndex: i })}
              onFkClick={handleFkClick}
            />
          </div>
        ) : null}
      </main>

      {activeTable && (
        <>
          <AddRowModal
            open={rowModal.open}
            table={activeTable}
            session={session}
            onClose={() => setRowModal({ open: false, editIndex: null })}
            onSubmit={handleRowSubmit}
            mode={rowModal.editIndex !== null ? 'edit' : 'add'}
            initialValues={rowModal.editIndex !== null ? activeTable.rows[rowModal.editIndex] : undefined}
          />
          <EditColumnsModal
            open={editColumnsOpen}
            table={activeTable}
            onClose={() => setEditColumnsOpen(false)}
            onApply={handleColumnsApply}
          />
        </>
      )}

      <Dialog open={!!closeWarning} onOpenChange={o => !o && setCloseWarning(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Close table?</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-medium text-foreground">{closeWarning ? tabLabel(closeWarning) : ''}</span>
              {' '}will be removed from the session. Unsaved changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseWarning(null)}>Nevermind</Button>
            <Button variant="destructive" onClick={() => closeWarning && handleRemoveTable(closeWarning)}>
              Close anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!replaceWarning} onOpenChange={o => !o && setReplaceWarning(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Replace table?</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-medium text-foreground">{replaceWarning?.filename}</span>
              {' '}is already loaded. Replace it with the new version?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplaceWarning(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (replaceWarning) loadIntoSession(replaceWarning.content, replaceWarning.filename, true)
              setReplaceWarning(null)
            }}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="bottom-right" />
    </div>
  )
}
