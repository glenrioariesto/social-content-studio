import { readFile } from 'fs/promises'
import { BOOTSTRAP_SETTINGS_PATH } from '@main/services/workspace-root'
import { logInfo, logError } from '@main/errors'
import { createAppError } from '@shared/errors'

export interface TypesafeChoiceResult {
  choice: string
  confidence: number
}

/**
 * Opt-in TypeSafe AI integration for classifying messy errors.
 * Degrades gracefully to null if no API key is set or network is unreachable.
 */
export async function classifyFfmpegError(stderr: string): Promise<string | null> {
  try {
    const rawSettings = await readFile(BOOTSTRAP_SETTINGS_PATH, 'utf-8').catch(() => '{}')
    const settings = JSON.parse(rawSettings)
    
    if (!settings.typesafeApiKey) {
      return null // Opt-in feature not enabled
    }

    logInfo('TypeSafe AI: Classifying FFmpeg error...')

    const response = await fetch('https://api.typesafe.ai/v1/choice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.typesafeApiKey}`
      },
      body: JSON.stringify({
        question: "Based on this FFmpeg stderr log, what is the primary reason the render failed?",
        state: { stderr: stderr.slice(-1000) }, // Send up to 1000 chars of context
        options: [
          { value: "codec_unsupported", description: "The source video format or codec is not supported by the x264/aac preset." },
          { value: "file_corrupted", description: "The source video file is corrupted, truncated, or unreadable." },
          { value: "out_of_memory", description: "FFmpeg ran out of memory (OOM) or system resources during processing." },
          { value: "unknown", description: "The error does not match any of the above categories clearly." }
        ]
      })
    })

    if (!response.ok) {
      logError(createAppError('FS_READ_ERROR', `TypeSafe API HTTP ${response.status}`, 'main'))
      return null
    }

    const data = await response.json() as TypesafeChoiceResult
    return data.choice

  } catch (err) {
    // Graceful degradation: log but do not disrupt the app flow
    logError(createAppError('FS_READ_ERROR', `TypeSafe API Error: ${(err as Error).message}`, 'main'))
    return null
  }
}
