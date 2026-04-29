// Root component — owns all app state. No backend; everything lives in localStorage (→ storage.ts).
//
// session: all open tables keyed by filename. Persisted on every mutation via updateSession().
// activeFilename: which tab is visible. highlight: row index to flash after FK navigation.
//
// Files enter: FileDropZone / file pickers → readFile → loadIntoSession → parseFile (parser.ts)
// Files exit:  Export buttons → serializeTable → exportTable / generateZipBlob (storage.ts)
// FK navigation: handleFkClick switches the active tab and sets highlight → TableView scrolls there.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Download, Columns3, X, ChevronDown, AlertTriangle, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileDropZone } from '@/components/FileDropZone'
import { TableView } from '@/components/TableView'
import { AddRowModal } from '@/components/AddRowModal'
import { EditColumnsModal } from '@/components/EditColumnsModal'
import JSZip from 'jszip'
import { parseFile, serializeTable } from '@/lib/parser'
import { saveSession, loadSession, exportTable, exportAllTables, generateZipBlob, type Session } from '@/lib/storage'
import { FSA_SUPPORTED, pickAndWrite, writeToHandle } from '@/lib/fsa'
import type { Column, Table } from '@/lib/types'

function tabLabel(filename: string) {
  return filename.replace(/\.ssql\.txt$/, '').replace(/\.txt$/, '')
}

function getAutoKey(table: Table): Column | null {
  const col = table.columns[0]
  return col && col.type === 'int' && !col.fk ? col : null
}

function computeNextId(table: Table, keyName: string): string {
  const ids = table.rows.map(r => parseInt(r[keyName], 10)).filter(n => !isNaN(n))
  return ids.length === 0 ? '1' : String(Math.max(...ids) + 1)
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
  const [exportAllOpen, setExportAllOpen] = useState(false)
  const [exportFolderName, setExportFolderName] = useState('similisql-export')
  const [exportWarning, setExportWarning] = useState<{ onConfirm: () => void } | null>(null)
  const [exportWarningSuppressed, setExportWarningSuppressed] = useState(
    () => localStorage.getItem('similisql:export-warning-dismissed') === 'true'
  )
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('similisql:theme') as 'light' | 'dark') ?? 'light'
  )
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [newTableOpen, setNewTableOpen] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const fileHandlesRef = useRef<Record<string, FileSystemFileHandle>>({})
  const zipHandleRef = useRef<FileSystemFileHandle | null>(null)

  const addTableRef = useRef<HTMLInputElement>(null)
  const importZipRef = useRef<HTMLInputElement>(null)
  const importFolderRef = useRef<HTMLInputElement>(null)

  const activeTable = activeFilename ? session[activeFilename] ?? null : null

  useEffect(() => {
    const saved = loadSession()
    if (Object.keys(saved).length > 0) {
      setSession(saved)
      setActiveFilename(Object.keys(saved)[0])
    }
  }, [])

  useEffect(() => {
    // Ctrl+S: re-save to the existing ZIP handle if one is stored, otherwise open the export dialog.
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (Object.keys(session).length === 0) return
        if (FSA_SUPPORTED && zipHandleRef.current) {
          const handle = zipHandleRef.current
          generateZipBlob(session).then(blob =>
            writeToHandle(handle, blob).then(ok => {
              if (ok) toast.success(`${exportFolderName}.zip saved`)
              else setExportAllOpen(true)
            })
          )
        } else {
          setExportAllOpen(true)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session, exportFolderName])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('similisql:theme', theme)
  }, [theme])

  useEffect(() => {
    if (highlight !== null) {
      const t = setTimeout(() => setHighlight(null), 2500)
      return () => clearTimeout(t)
    }
  }, [highlight])

  // Single mutation point — always use this instead of setSession directly so localStorage stays in sync.
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

  function handleCreateTable() {
    const name = newTableName.trim()
    if (!name) return
    const filename = name.endsWith('.ssql.txt') ? name : `${name}.ssql.txt`
    if (filename in session) {
      toast.error(`A table named "${tabLabel(filename)}" is already open`)
      return
    }
    const next = { ...session, [filename]: { columns: [], rows: [] } }
    updateSession(next)
    setActiveFilename(filename)
    setNewTableOpen(false)
    setNewTableName('')
  }

  async function handleImportZip(file: File) {
    try {
      const zip = await JSZip.loadAsync(file)
      const loaded: Session = {}
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        const name = path.split('/').pop()!
        if (!name.endsWith('.ssql.txt') && !name.endsWith('.txt')) continue
        const content = await entry.async('text')
        const result = parseFile(content)
        if (result.status === 'valid') loaded[name] = result.table
        else if (result.status === 'empty') loaded[name] = { columns: [], rows: [] }
      }
      const count = Object.keys(loaded).length
      if (count === 0) { toast.error('No valid tables found in ZIP'); return }
      const next = { ...session, ...loaded }
      updateSession(next)
      setActiveFilename(Object.keys(loaded)[0])
      toast.success(`Loaded ${count} table${count !== 1 ? 's' : ''} from ZIP`)
    } catch {
      toast.error('Failed to read ZIP file')
    }
  }

  function handleImportFolder(files: FileList) {
    const txtFiles = Array.from(files).filter(f => f.name.endsWith('.ssql.txt') || f.name.endsWith('.txt'))
    if (txtFiles.length === 0) { toast.error('No .ssql.txt files found in folder'); return }
    const loaded: Session = {}
    let pending = txtFiles.length
    for (const file of txtFiles) {
      const reader = new FileReader()
      reader.onload = e => {
        const content = e.target?.result as string
        const result = parseFile(content)
        if (result.status === 'valid') loaded[file.name] = result.table
        else if (result.status === 'empty') loaded[file.name] = { columns: [], rows: [] }
        pending--
        if (pending === 0) {
          const count = Object.keys(loaded).length
          if (count === 0) { toast.error('No valid tables found in folder'); return }
          const next = { ...session, ...loaded }
          updateSession(next)
          setActiveFilename(Object.keys(loaded)[0])
          toast.success(`Loaded ${count} table${count !== 1 ? 's' : ''} from folder`)
        }
      }
      reader.readAsText(file)
    }
  }

  // Switches to the target table tab and highlights the row that matches the FK value.
  // TableView.tsx picks up `highlight` and scrolls to that row automatically.
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

  function handleDeleteRow(index: number) {
    if (!activeTable || !activeFilename) return
    const deletedRow = activeTable.rows[index]
    const filename = activeFilename
    const rows = activeTable.rows.filter((_, i) => i !== index)
    const next = { ...session, [filename]: { ...activeTable, rows } }
    updateSession(next)
    toast.success('Row deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          setSession(prev => {
            const table = prev[filename]
            if (!table) return prev
            const restored = [...table.rows.slice(0, index), deletedRow, ...table.rows.slice(index)]
            const updated = { ...prev, [filename]: { ...table, rows: restored } }
            saveSession(updated)
            return updated
          })
        },
      },
    })
  }

  function handleRowSubmit(row: Record<string, string>) {
    if (!activeTable || !activeFilename) return
    const autoKey = getAutoKey(activeTable)
    const finalRow = { ...row }
    if (rowModal.editIndex === null && autoKey) {
      finalRow[autoKey.name] = computeNextId(activeTable, autoKey.name)
    }
    const rows = rowModal.editIndex !== null
      ? activeTable.rows.map((r, i) => i === rowModal.editIndex ? finalRow : r)
      : [...activeTable.rows, finalRow]
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

  function dismissWarning() {
    if (dontShowAgain) {
      localStorage.setItem('similisql:export-warning-dismissed', 'true')
      setExportWarningSuppressed(true)
    }
  }

  async function handleExportCurrent() {
    if (!activeTable || !activeFilename) return
    if (FSA_SUPPORTED) {
      const existingHandle = fileHandlesRef.current[activeFilename]
      const blob = new Blob([serializeTable(activeTable)], { type: 'text/plain' })
      if (existingHandle) {
        const ok = await writeToHandle(existingHandle, blob)
        if (ok) { toast.success(`${activeFilename} saved`); return }
        // handle stale — fall through to picker
      }
      const handle = await pickAndWrite(blob, activeFilename, { 'text/plain': ['.txt'] as `.${string}`[] })
      if (handle) {
        fileHandlesRef.current[activeFilename] = handle
        toast.success(`${activeFilename} saved`)
      }
      return
    }
    if (exportWarningSuppressed) {
      exportTable(activeTable, activeFilename)
      toast.success('File downloaded')
      return
    }
    setDontShowAgain(false)
    setExportWarning({
      onConfirm: () => {
        dismissWarning()
        exportTable(activeTable!, activeFilename!)
        toast.success('File downloaded')
        setExportWarning(null)
      },
    })
  }

  async function handleExportAll() {
    if (!exportFolderName.trim()) return
    if (FSA_SUPPORTED) {
      const blob = await generateZipBlob(session)
      // Re-use existing zip handle if name matches, otherwise pick new location
      if (zipHandleRef.current) {
        const ok = await writeToHandle(zipHandleRef.current, blob)
        if (ok) {
          setExportAllOpen(false)
          toast.success(`${exportFolderName}.zip saved`)
          return
        }
        // handle stale — fall through to picker
      }
      const handle = await pickAndWrite(blob, `${exportFolderName}.zip`, { 'application/zip': ['.zip'] as `.${string}`[] })
      if (handle) {
        zipHandleRef.current = handle
        setExportAllOpen(false)
        toast.success(`${exportFolderName}.zip saved`)
      }
      return
    }
    dismissWarning()
    await exportAllTables(session, exportFolderName)
    setExportAllOpen(false)
    toast.success(`${exportFolderName}.zip downloaded`)
  }

  const filenames = Object.keys(session)
  const isEmpty = filenames.length === 0

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 bg-[var(--header-bg)] border-b-2 border-[var(--header-border)] px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Logo — blob + titre pixel */}
        <div className="flex items-center gap-2 shrink-0">
          <img src="/favicon.svg" className="h-5 w-auto" alt="similisql" style={{ imageRendering: 'pixelated' }} />
          <span className="text-[var(--header-fg)] text-[8px] tracking-widest leading-none" style={{ fontFamily: 'var(--font-pixel)' }}>
            SIMILISQL
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {filenames.map(fn => (
            <div
              key={fn}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono shrink-0 cursor-pointer transition-colors border ${
                fn === activeFilename
                  ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)] border-[var(--tab-active-bg)]'
                  : 'text-[var(--header-muted)] border-transparent hover:border-[var(--header-border)] hover:text-[var(--header-fg)]'
              }`}
              onClick={() => handleTabClick(fn)}
            >
              <span>{tabLabel(fn)}</span>
              <button
                onClick={e => { e.stopPropagation(); confirmRemoveTable(fn) }}
                className="opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => { setNewTableName(''); setNewTableOpen(true) }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--header-muted)] hover:text-[var(--header-fg)] transition-colors shrink-0"
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
              setNewTableOpen(false)
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeTable && (
            <>
              <Button
                variant="ghost" size="sm"
                className="text-[var(--header-fg)] border border-[var(--header-border)] hover:bg-[rgba(212,216,176,0.10)] hover:text-[var(--header-fg)] text-xs"
                onClick={() => setEditColumnsOpen(true)}
              >
                <Columns3 className="w-4 h-4 mr-1.5" />
                Edit columns
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button
                    variant="ghost" size="sm"
                    className="text-[var(--header-fg)] border border-[var(--header-border)] hover:bg-[rgba(212,216,176,0.10)] hover:text-[var(--header-fg)] text-xs"
                  />
                }>
                  <Download className="w-4 h-4 mr-1.5" />
                  Export
                  <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCurrent}>
                    Current table
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setExportAllOpen(true)}>
                    All tables…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                className="bg-[var(--tab-active-bg)] text-[var(--tab-active-text)] hover:opacity-80 text-xs"
                onClick={() => setRowModal({ open: true, editIndex: null })}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add row
              </Button>
            </>
          )}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="p-2 text-[var(--header-muted)] hover:text-[var(--header-fg)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Open a file</h1>
              <p className="text-muted-foreground text-sm">
                Drop a file or archive, or click the <span className="font-mono">+</span> tab to create a new table
              </p>
            </div>
            <FileDropZone
              onFile={(content, name) => loadIntoSession(content, name)}
              onZip={handleImportZip}
            />
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => importZipRef.current?.click()}>
                Import ZIP
              </Button>
              <Button variant="outline" size="sm" onClick={() => importFolderRef.current?.click()}>
                Import folder
              </Button>
            </div>
            <input
              ref={importZipRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleImportZip(file)
                e.target.value = ''
              }}
            />
            <input
              ref={importFolderRef}
              type="file"
              className="hidden"
              // @ts-expect-error webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              multiple
              onChange={e => {
                if (e.target.files) handleImportFolder(e.target.files)
                e.target.value = ''
              }}
            />
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
              onDeleteRow={handleDeleteRow}
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
            autoKeyName={getAutoKey(activeTable)?.name ?? null}
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

      {/* Warning dialog — single file export only */}
      <Dialog open={!!exportWarning} onOpenChange={o => !o && setExportWarning(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <DialogTitle>Overwrite warning</DialogTitle>
            </div>
            <DialogDescription className="pt-1">
              If a file with this name already exists in your downloads folder, your browser may rename it rather than overwrite it — this is a browser restriction that can't be bypassed from a web app.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input type="checkbox" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)} className="rounded border-input accent-primary w-4 h-4" />
            <span className="text-sm text-muted-foreground">Don't show this again</span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportWarning(null)}>Cancel</Button>
            <Button onClick={() => exportWarning?.onConfirm()}>Download anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export all — warning inline, single dialog */}
      <Dialog open={exportAllOpen} onOpenChange={o => !o && setExportAllOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Export all tables</DialogTitle>
            <DialogDescription>
              {Object.keys(session).length} table{Object.keys(session).length !== 1 ? 's' : ''} will be bundled into a ZIP file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Archive name</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={exportFolderName}
                  onChange={e => setExportFolderName(e.target.value)}
                  className="font-mono text-sm"
                  onKeyDown={e => e.key === 'Enter' && exportFolderName.trim() && handleExportAll()}
                  autoFocus
                />
                <span className="text-sm text-muted-foreground shrink-0">.zip</span>
              </div>
            </div>
            {!FSA_SUPPORTED && !exportWarningSuppressed && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">If a file with this name already exists in your downloads folder, your browser may rename it rather than overwrite it — browser restriction, can't be bypassed.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)} className="rounded border-input accent-primary w-3.5 h-3.5" />
                  <span className="text-xs text-muted-foreground">Don't show this again</span>
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportAllOpen(false)}>Cancel</Button>
            <Button onClick={handleExportAll} disabled={!exportFolderName.trim()}>
              <Download className="w-4 h-4 mr-1.5" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={newTableOpen} onOpenChange={o => !o && setNewTableOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Table name</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTable()}
                  placeholder="my_table"
                  className="font-mono text-sm"
                  autoFocus
                />
                <span className="text-xs text-muted-foreground shrink-0">.ssql.txt</span>
              </div>
            </div>
            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={() => addTableRef.current?.click()}>
              Open existing file…
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewTableOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTable} disabled={!newTableName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="bottom-right" />
    </div>
  )
}
