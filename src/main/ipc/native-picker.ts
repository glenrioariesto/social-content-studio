import { dialog } from 'electron'

/** Open a native picker in main; returns the chosen absolute path or null if cancelled. */
export async function pickSourceFile(filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}