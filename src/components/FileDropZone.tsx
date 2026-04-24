import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  onFile: (content: string, filename: string) => void
  onZip?: (file: File) => void
}

export function FileDropZone({ onFile, onZip }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function readFile(file: File) {
    if (file.name.endsWith('.zip') && onZip) { onZip(file); return }
    const reader = new FileReader()
    reader.onload = e => onFile(e.target?.result as string, file.name)
    reader.readAsText(file)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) readFile(file)
      }}
      className={`
        group relative flex flex-col items-center justify-center gap-4
        w-full max-w-lg mx-auto aspect-video rounded-2xl border-2 border-dashed
        cursor-pointer transition-all duration-200
        ${dragging
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }
      `}
    >
      <div className={`p-4 rounded-full bg-muted transition-all duration-200 ${dragging ? 'bg-primary/10' : 'group-hover:bg-primary/5'}`}>
        <Upload className={`w-8 h-8 transition-colors ${dragging ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
      </div>
      <div className="text-center space-y-1">
        <p className="font-medium text-foreground">Drop a <span className="font-mono">.ssql.txt</span> or <span className="font-mono">.zip</span> here</p>
        <p className="text-sm text-muted-foreground">or click to browse</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.zip"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
