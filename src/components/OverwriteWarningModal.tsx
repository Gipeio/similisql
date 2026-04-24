import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  currentFilename: string
  onDownloadAndReplace: () => void
  onReplace: () => void
  onCancel: () => void
}

export function OverwriteWarningModal({ open, currentFilename, onDownloadAndReplace, onReplace, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <DialogTitle>Replace current file?</DialogTitle>
          </div>
          <DialogDescription className="pt-1">
            <span className="font-mono font-medium text-foreground">{currentFilename}</span>
            {' '}is currently loaded. Loading a new file will replace it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onCancel} className="sm:mr-auto">
            Cancel
          </Button>
          <Button variant="outline" onClick={onDownloadAndReplace}>
            Download & replace
          </Button>
          <Button variant="destructive" onClick={onReplace}>
            Replace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
