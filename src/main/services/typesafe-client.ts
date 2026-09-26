import { readFile } from 'fs/promises'
import { BOOTSTRAP_SETTINGS_PATH } from '@main/services/workspace-root'
import { logInfo, logError } from '@main/errors'
import { createAppError } from '@shared/errors'

export interface TypesafeChoiceResult {
  choice: string
  confidence: number
}

export interface TypesafeScoreResult {
  score: number
  confidence: number
}

async function getTypesafeApiKey(): Promise<string | null> {
  try {
    const rawSettings = await readFile(BOOTSTRAP_SETTINGS_PATH, 'utf-8').catch(() => '{}')
    const settings = JSON.parse(rawSettings)
    return settings.typesafeApiKey || null
  } catch {
    return null
  }
}

/**
 * Opt-in TypeSafe AI integration for classifying messy errors.
 * Degrades gracefully to null if no API key is set or network is unreachable.
 */
export async function classifyFfmpegError(stderr: string): Promise<string | null> {
  try {
    const apiKey = await getTypesafeApiKey()
    if (!apiKey) {
      return null // Opt-in feature not enabled
    }

    logInfo('TypeSafe AI: Classifying FFmpeg error...')

    const response = await fetch('https://api.typesafe.ai/v1/choice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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

/**
 * Uses AI to semantically categorize an asset based on its filename.
 */
export async function classifyAssetType(filename: string): Promise<'images' | 'audio' | 'video' | 'fonts' | null> {
  try {
    const apiKey = await getTypesafeApiKey()
    if (!apiKey) return null

    logInfo(`TypeSafe AI: Categorizing asset "${filename}"...`)

    const response = await fetch('https://api.typesafe.ai/v1/choice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        question: "Based on this filename, what is the semantic asset category?",
        state: { filename },
        options: [
          { value: "images", description: "Visual graphics, photos, overlays (png, jpg, webp)" },
          { value: "audio", description: "Sound effects, background music, voiceovers (mp3, wav)" },
          { value: "video", description: "B-roll, clips, animations (mp4, webm)" },
          { value: "fonts", description: "Typography files (ttf, otf, woff)" }
        ]
      })
    })

    if (!response.ok) return null
    
    const data = await response.json() as TypesafeChoiceResult
    return data.choice as 'images' | 'audio' | 'video' | 'fonts'

  } catch {
    return null
  }
}

/**
 * Uses AI to validate if text content meets professional brand guidelines.
 */
export async function checkBrandGuardrails(content: string): Promise<boolean> {
  try {
    const apiKey = await getTypesafeApiKey()
    if (!apiKey) return true // Fail open if unconfigured

    logInfo(`TypeSafe AI: Running brand guardrails on content...`)

    const response = await fetch('https://api.typesafe.ai/v1/noul', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        question: "Does this text align with a professional brand tone and is it free of profanity or aggressive language?",
        state: { text: content.slice(0, 2000) } // Check up to 2000 chars
      })
    })

    if (!response.ok) return true // Fail open on API error
    
    const data = await response.json() as { noul: number }
    // Return true if probability of being professional is > 0.6
    return data.noul > 0.6

  } catch {
    return true // Fail open on network/parsing error
  }
}

/**
 * Uses AI to score how relevant an asset is to a specific template.
 */
export async function scoreAssetRelevance(templateMetadata: Record<string, unknown>, assetName: string): Promise<number | null> {
  try {
    const apiKey = await getTypesafeApiKey()
    if (!apiKey) return null

    logInfo(`TypeSafe AI: Scoring relevance of asset "${assetName}" to template...`)

    const response = await fetch('https://api.typesafe.ai/v1/score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        question: "Based on the template metadata and the asset filename, how relevant is this asset for the template?",
        state: { templateMetadata, assetName },
        levels: [
          { max: 20, description: "Completely irrelevant. Wrong media type or highly mismatching content." },
          { max: 50, description: "Generic asset that could work, but isn't specifically tailored." },
          { max: 80, description: "Good match. The asset aligns well with the template's purpose." },
          { max: 100, description: "Perfect match. The asset is explicitly designed or named for this template." }
        ]
      })
    })

    if (!response.ok) return null
    
    const data = await response.json() as TypesafeScoreResult
    return data.score

  } catch {
    return null
  }
}
