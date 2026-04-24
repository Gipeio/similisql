import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Download, FolderOpen, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { FileDropZone } from '@/components/FileDropZone'
import { TableView } from '@/components/TableView'
import { AddRowModal } from '@/components/AddRowModal'
import { OverwriteWarningModal } from '@/components/OverwriteWarningModal'
import { parseFile } from '@/lib/parser'
import { saveTable, loadCachedTable, exportTable } from '@/lib/storage'
import type { Table } from '@/lib/types'

type PendingFile = { content: string; filename: string }

export default function App() {
  const [table, setTable] = useState<Table | null>(null)
  const [filename, setFilename] = useState<string>('')
  const [rowModalOpen, setRowModalOpen] = useState(false)
  const [editRowIndex, setEditRowIndex] = useState<number | null>(null)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)

  useEffect(() => {
    const cached = loadCachedTable()
    if (!cached) return
    const result = parseFile(cached.content)
    if (result.status === 'valid') {
      setTable(result.table)
      setFilename(cached.filename)
    }
  }, [])

  function handleFile(content: string, name: string) {
    if (table) {
      setPendingFile({ content, filename: name })
      return
    }
    loadFile(content, name)
  }

  function loadFile(content: string, name: string) {
    const result = parseFile(content)
    if (result.status === 'empty') {
      setTable({ columns: [], rows: [] })
      setFilename(name)
      toast.info('Empty file loaded. Define columns to get started.')
      return
    }
    if (result.status === 'invalid') {
      toast.error(result.error)
      return
    }
    setTable(result.table)
    setFilename(name)
    saveTable(result.table, name)
    toast.success(`Loaded ${result.table.rows.length} row(s)`)
  }

  function handleRowSubmit(row: Record<string, string>) {
    if (!table) return
    const rows = editRowIndex !== null
      ? table.rows.map((r, i) => i === editRowIndex ? row : r)
      : [...table.rows, row]
    const updated = { ...table, rows }
    setTable(updated)
    saveTable(updated, filename)
    toast.success(editRowIndex !== null ? 'Row updated' : 'Row added')
  }

  function handleEditRow(index: number) {
    setEditRowIndex(index)
    setRowModalOpen(true)
  }

  function handleOpenAdd() {
    setEditRowIndex(null)
    setRowModalOpen(true)
  }

  function handleCloseModal() {
    setRowModalOpen(false)
    setEditRowIndex(null)
  }

  function handleExport() {
    if (!table) return
    exportTable(table, filename)
    toast.success('File downloaded')
  }

  function handleOverwriteCancel() {
    setPendingFile(null)
  }

  function handleOverwriteReplace() {
    if (!pendingFile) return
    loadFile(pendingFile.content, pendingFile.filename)
    setPendingFile(null)
  }

  function handleDownloadAndReplace() {
    if (!table) return
    exportTable(table, filename)
    handleOverwriteReplace()
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <span className="font-mono font-semibold tracking-tight text-lg">similisql</span>
          {filename && (
            <span className="text-muted-foreground font-mono text-sm">/ {filename}</span>
          )}
        </div>
        {table && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingFile({ content: '', filename: '' })}>
              <FolderOpen className="w-4 h-4 mr-1.5" />
              Open
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </Button>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add row
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 p-6">
        {!table ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Open a file</h1>
              <p className="text-muted-foreground text-sm">
                Drop a <span className="font-mono">.ssql.txt</span> file to visualize and edit it
              </p>
            </div>
            <FileDropZone onFile={handleFile} />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              {table.rows.length} row{table.rows.length !== 1 ? 's' : ''} · {table.columns.length} column{table.columns.length !== 1 ? 's' : ''}
            </p>
            <TableView table={table} onEditRow={handleEditRow} />
          </div>
        )}
      </main>

      {table && (
        <AddRowModal
          open={rowModalOpen}
          table={table}
          onClose={handleCloseModal}
          onSubmit={handleRowSubmit}
          mode={editRowIndex !== null ? 'edit' : 'add'}
          initialValues={editRowIndex !== null ? table.rows[editRowIndex] : undefined}
        />
      )}

      <OverwriteWarningModal
        open={!!pendingFile && !!table}
        currentFilename={filename}
        onCancel={handleOverwriteCancel}
        onReplace={handleOverwriteReplace}
        onDownloadAndReplace={handleDownloadAndReplace}
      />

      <Toaster richColors position="bottom-right" />
    </div>
  )
}
