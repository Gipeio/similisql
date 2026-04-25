// File System Access API — Chromium-only feature that lets the app write directly to disk.
// pickAndWrite: opens "Save As", writes the blob, returns a handle for future re-saves without a dialog.
// writeToHandle: re-saves to the same file using a handle stored in App.tsx (fileHandlesRef / zipHandleRef).

export const FSA_SUPPORTED = typeof window !== 'undefined' && 'showSaveFilePicker' in window

type MimeType = `${string}/${string}`
type FileExt = `.${string}`

export async function pickAndWrite(
  blob: Blob,
  suggestedName: string,
  accept: Record<MimeType, FileExt[]>,
): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'File', accept }],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return handle
  } catch {
    // User cancelled or permission denied
    return null
  }
}

export async function writeToHandle(handle: FileSystemFileHandle, blob: Blob): Promise<boolean> {
  try {
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch {
    return false
  }
}
