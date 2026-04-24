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
