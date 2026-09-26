import { readFile } from 'fs/promises'
import { getBootstrapSettingsPath } from '@main/services/workspace-root'
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

interface AiConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  legacyKey: string | null
}

async function getAiConfig(): Promise<AiConfig> {
  try {
    const rawSettings = await readFile(getBootstrapSettingsPath(), 'utf-8').catch(() => '{}')
    const settings = JSON.parse(rawSettings)
    const hasTypesafeKey = typeof settings.typesafeApiKey === 'string' && settings.typesafeApiKey.length > 0
    const provider = settings.aiProvider || (hasTypesafeKey ? 'typesafe' : (process.env.API_KEY ? 'opencode' : 'typesafe'))
    return {
      provider,
      baseUrl: settings.aiBaseUrl || (provider === 'opencode' ? (process.env.AI_BASE_URL || 'https://api.opencode.ai/v1') : ''),
      apiKey: settings.aiApiKey || (provider === 'opencode' ? (process.env.API_KEY || '') : ''),
      model: settings.aiModel || (provider === 'opencode' ? (process.env.AI_MODEL || 'opencode-default-model') : ''),
      legacyKey: settings.typesafeApiKey || null
    }
  } catch {
    return { provider: 'typesafe', baseUrl: '', apiKey: '', model: '', legacyKey: null }
  }
}

async function callAiProvider<T>(
  systemMessage: string, 
  userMessage: string, 
  legacyEndpoint: string,
  legacyPayload: any
): Promise<T | null> {
  const config = await getAiConfig()
  
  // Use legacy typesafe.ai integration
  if (config.provider === 'typesafe') {
    const key = config.apiKey || config.legacyKey
    if (!key) return null
    
    const response = await fetch(`https://api.typesafe.ai/v1/${legacyEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(legacyPayload)
    })
    if (!response.ok) return null
    return (await response.json()) as T
  }

  // Universal OpenAI-compatible integration for Antigravity/Claude/Custom
  if (!config.apiKey) return null
  
  let url = config.baseUrl || 'https://api.openai.com/v1'
  if (config.provider === 'antigravity') {
    url = config.baseUrl || 'https://api.antigravity.ai/v1'
  } else if (config.provider === 'opencode') {
    url = config.baseUrl || 'https://api.opencode.ai/v1' // Asumsi base URL default
  } else if (config.provider === 'claude') {
    // If using Anthropic directly, the format is totally different!
    // For simplicity, we assume the user intends an OpenAI-compatible proxy (like OpenRouter or Antigravity)
    // if they put "claude" but didn't set a custom URL. Wait, if it's native Anthropic, we should handle it.
    // Let's implement native Anthropic just in case.
  }
  
  const model = config.model || (config.provider === 'antigravity' ? 'antigravity-3-5-sonnet' : config.provider === 'opencode' ? 'opencode-default-model' : 'gpt-4o-mini')
  
  if (config.provider === 'claude' && !config.baseUrl?.includes('openai')) {
    // Native Anthropic Messages API
    const response = await fetch(`${config.baseUrl || 'https://api.anthropic.com/v1'}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: systemMessage,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    })
    if (!response.ok) return null
    const data = await response.json() as any
    
    // Parse legacy expected JSON from text block
    try {
      const text = data.content?.[0]?.text || ''
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text
      return JSON.parse(jsonStr) as T
    } catch {
      return null
    }
  } else {
    // Standard OpenAI compatible
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ]
      })
    })
    if (!response.ok) return null
    const data = await response.json() as any
    
    try {
      const text = data.choices?.[0]?.message?.content || ''
      // Extract JSON block in case the model wraps it in markdown (```json ... ```) or plain text
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || text
      return JSON.parse(jsonStr) as T
    } catch {
      return null
    }
  }
}

/**
 * Opt-in TypeSafe AI integration for classifying messy errors.
 * Degrades gracefully to null if no API key is set or network is unreachable.
 */
export async function classifyFfmpegError(stderr: string): Promise<string | null> {
  try {
    logInfo('AI: Classifying FFmpeg error...')

    const systemMsg = `You are a video encoding expert. Output a JSON object with a single "choice" key. Based on the FFmpeg stderr log, what is the primary reason the render failed? Choices:
- codec_unsupported: source video format/codec unsupported.
- file_corrupted: source video is corrupted or unreadable.
- out_of_memory: ran out of memory.
- unknown: error doesn't match above categories clearly.`

    const userMsg = stderr.slice(-1000)
    
    const legacyPayload = {
      question: "Based on this FFmpeg stderr log, what is the primary reason the render failed?",
      state: { stderr: userMsg },
      options: [
        { value: "codec_unsupported", description: "The source video format or codec is not supported by the x264/aac preset." },
        { value: "file_corrupted", description: "The source video file is corrupted, truncated, or unreadable." },
        { value: "out_of_memory", description: "FFmpeg ran out of memory (OOM) or system resources during processing." },
        { value: "unknown", description: "The error does not match any of the above categories clearly." }
      ]
    }

    const result = await callAiProvider<TypesafeChoiceResult>(systemMsg, userMsg, 'choice', legacyPayload)
    return result?.choice || null
  } catch (err) {
    logError(createAppError('FS_READ_ERROR', `AI API Error: ${(err as Error).message}`, 'main'))
    return null
  }
}

/**
 * Uses AI to semantically categorize an asset based on its filename.
 */
export async function classifyAssetType(filename: string): Promise<'images' | 'audio' | 'video' | 'fonts' | null> {
  try {
    logInfo(`AI: Categorizing asset "${filename}"...`)

    const systemMsg = `You are a categorization assistant. Output a JSON object with a single "choice" key. Based on the filename, what is the semantic asset category? Choices:
- images: Visual graphics, photos, overlays (png, jpg, webp)
- audio: Sound effects, background music, voiceovers (mp3, wav)
- video: B-roll, clips, animations (mp4, webm)
- fonts: Typography files (ttf, otf, woff)`
    
    const userMsg = filename

    const legacyPayload = {
      question: "Based on this filename, what is the semantic asset category?",
      state: { filename },
      options: [
        { value: "images", description: "Visual graphics, photos, overlays (png, jpg, webp)" },
        { value: "audio", description: "Sound effects, background music, voiceovers (mp3, wav)" },
        { value: "video", description: "B-roll, clips, animations (mp4, webm)" },
        { value: "fonts", description: "Typography files (ttf, otf, woff)" }
      ]
    }

    const result = await callAiProvider<TypesafeChoiceResult>(systemMsg, userMsg, 'choice', legacyPayload)
    return (result?.choice as 'images' | 'audio' | 'video' | 'fonts') || null
  } catch {
    return null
  }
}

/**
 * Uses AI to validate if text content meets professional brand guidelines.
 */
export async function checkBrandGuardrails(content: string): Promise<boolean> {
  try {
    logInfo(`AI: Running brand guardrails on content...`)

    const systemMsg = `You are a brand safety filter. Output a JSON object with a single "noul" key (number between 0.0 and 1.0). 1.0 means highly professional, 0.0 means highly profane or aggressive. Does this text align with a professional brand tone and is it free of profanity or aggressive language?`
    
    const userMsg = content.slice(0, 2000)
    
    const legacyPayload = {
      question: "Does this text align with a professional brand tone and is it free of profanity or aggressive language?",
      state: { text: userMsg }
    }
    
    // For noul endpoint, the Typesafe interface returns { noul: number }
    const result = await callAiProvider<{ noul: number }>(systemMsg, userMsg, 'noul', legacyPayload)
    
    if (!result || typeof result.noul !== 'number') return true // Fail open on error
    return result.noul > 0.6
  } catch {
    return true // Fail open
  }
}

/**
 * Uses AI to score how relevant an asset is to a specific template.
 */
export async function scoreAssetRelevance(templateMetadata: Record<string, unknown>, assetName: string): Promise<number | null> {
  try {
    logInfo(`AI: Scoring relevance of asset "${assetName}" to template...`)

    const systemMsg = `You are an asset matching engine. Output a JSON object with a single "score" key (integer 0-100). Based on the template metadata and the asset filename, how relevant is this asset for the template?
- 0-20: Completely irrelevant. Wrong media type or highly mismatching content.
- 21-50: Generic asset that could work, but isn't specifically tailored.
- 51-80: Good match. The asset aligns well with the template's purpose.
- 81-100: Perfect match. The asset is explicitly designed or named for this template.`

    const userMsg = JSON.stringify({ templateMetadata, assetName })

    const legacyPayload = {
      question: "Based on the template metadata and the asset filename, how relevant is this asset for the template?",
      state: { templateMetadata, assetName },
      levels: [
        { max: 20, description: "Completely irrelevant. Wrong media type or highly mismatching content." },
        { max: 50, description: "Generic asset that could work, but isn't specifically tailored." },
        { max: 80, description: "Good match. The asset aligns well with the template's purpose." },
        { max: 100, description: "Perfect match. The asset is explicitly designed or named for this template." }
      ]
    }

    const result = await callAiProvider<TypesafeScoreResult>(systemMsg, userMsg, 'score', legacyPayload)
    return result?.score ?? null
  } catch {
    return null
  }
}

/**
 * Uses AI to select the best matching HTML template for a given piece of content.
 */
export async function suggestTemplateForContent(
  contentSnippet: string,
  availableTemplates: { id: string; name: string; type: string }[]
): Promise<string | null> {
  try {
    if (availableTemplates.length === 0) return null

    logInfo(`AI: Suggesting template for content...`)

    const systemMsg = `You are a template routing agent. Output a JSON object with a single "choice" key containing the ID of the chosen template. Based on the content snippet, which of these templates is the most semantically appropriate match?
Available templates:
${availableTemplates.map(t => `- ID: ${t.id} (${t.name}, Type: ${t.type})`).join('\n')}`

    const userMsg = contentSnippet

    const legacyPayload = {
      question: "Based on the content snippet, which of these templates is the most semantically appropriate match?",
      state: { contentSnippet },
      options: availableTemplates.map(t => ({
        value: t.id,
        description: `${t.name} (Type: ${t.type})`
      }))
    }

    const result = await callAiProvider<TypesafeChoiceResult>(systemMsg, userMsg, 'choice', legacyPayload)
    return result?.choice || null
  } catch {
    return null
  }
}

/**
 * Tests the currently configured AI connection
 */
export async function testAiConnection(): Promise<boolean> {
  try {
    logInfo('AI: Testing connection to provider...')
    const systemMsg = "You are a test bot. Reply with exactly the word 'OK' and nothing else."
    const userMsg = "Ping"
    const legacyPayload = {
      question: "Are you online?",
      state: {},
      options: [{ value: "OK", description: "Yes" }]
    }
    
    // For legacy typesafe we expect a TypesafeChoiceResult
    const result = await callAiProvider<any>(systemMsg, userMsg, 'choice', legacyPayload)
    return !!result
  } catch {
    return false
  }
}




export async function generateContentMetadata(title: string): Promise<{ description: string, caption: string, hashtags: string } | null> {
  const systemMsg = `You are a metadata generator. Based on the user's title, generate a short description, a social media caption, and some relevant hashtags.
Return JSON ONLY with keys "description" (string), "caption" (string), "hashtags" (comma-separated string).`
  const userMsg = title;
  
  const legacyPayload = {
    question: "Generate metadata for this title",
    state: { title }
  }

  try {
    const result = await callAiProvider<any>(systemMsg, userMsg, 'generate', legacyPayload)
    if (result) {
      if (typeof result.description === 'string' && typeof result.caption === 'string') {
        return {
          description: result.description,
          caption: result.caption,
          hashtags: result.hashtags || ''
        }
      }
      
      // If it returned a raw string, we might need to parse it (some providers might not respect JSON formatting natively)
      if (typeof result === 'string') {
        try {
          const parsed = JSON.parse(result)
          return {
            description: parsed.description || '',
            caption: parsed.caption || '',
            hashtags: parsed.hashtags || ''
          }
        } catch (e) {
          // parse failed
        }
      } else if (result.choices && result.choices[0] && result.choices[0].message) {
        // Handle native OpenAI response format if T wasn't unwrapped properly
        try {
          let content = result.choices[0].message.content
          // Strip markdown code blocks if present
          content = content.replace(/^\s*```(json)?/m, '').replace(/```\s*$/m, '').trim()
          const parsed = JSON.parse(content)
          return {
            description: parsed.description || '',
            caption: parsed.caption || '',
            hashtags: parsed.hashtags || ''
          }
        } catch (e) {
          // parse failed
        }
      }
    }
    return null
  } catch (error) {
    return null
  }
}
