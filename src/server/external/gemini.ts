import { GoogleGenAI, Type } from '@google/genai';
import type { ExtractedDataPayload, ServiceState } from '../../shared/types/index.ts';
import { ExtractedDataPayloadSchema, normalizeExtractionInput } from '../../shared/schemas/extraction.ts';
import { APP_CONFIG, PRIORITY_GAMES, TARGET_BENCHMARK_FAMILIES } from '../../shared/constants/index.ts';
import { config } from '../config.ts';

let geminiClientInstance: GoogleGenAI | null = null;

export function getGeminiModelName(): string {
  const model = config.geminiModel?.trim();
  // Ensure the model ID is a valid identifier and never an API key
  if (model && !model.startsWith('AIza') && !model.startsWith('AQ.') && !model.includes('"') && !model.includes("'")) {
    return model;
  }
  return APP_CONFIG.defaultGeminiModel || 'gemini-3.8-flash';
}

export function getGeminiClient(): GoogleGenAI {
  if (geminiClientInstance) {
    return geminiClientInstance;
  }

  const apiKey = config.geminiApiKey?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_NOT_CONFIGURED: GEMINI_API_KEY environment variable is not set.');
  }

  geminiClientInstance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return geminiClientInstance;
}

export function isGeminiConfigured(): boolean {
  return Boolean(config.geminiApiKey?.trim());
}

export interface GeminiHealthResult {
  status: ServiceState;
  model: string;
  latencyMs?: number;
  error?: string;
}

export async function testGeminiConnection(): Promise<GeminiHealthResult> {
  const modelName = getGeminiModelName();

  if (!isGeminiConfigured()) {
    return {
      status: 'NOT_CONFIGURED',
      model: modelName,
      error: 'GEMINI_API_KEY is not configured in server environment.',
    };
  }

  const maxAttempts = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const start = Date.now();
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: modelName,
        contents: 'Reply with exactly OK.',
      });

      const latencyMs = Date.now() - start;
      const text = response.text?.trim() || '';

      if (text.toUpperCase().includes('OK')) {
        return {
          status: 'LIVE',
          model: modelName,
          latencyMs,
        };
      }

      return {
        status: 'WARNING',
        model: modelName,
        latencyMs,
        error: `Unexpected test response: ${text.slice(0, 50)}`,
      };
    } catch (err: any) {
      lastError = err;
      const statusCode = err?.status || err?.code;
      // 503: High demand spike. Perform 1 bounded retry
      if (statusCode === 503 && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      break;
    }
  }

  const rawMsg = lastError?.message || String(lastError);
  const sanitizedMsg = rawMsg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/AQ\.[A-Za-z0-9_-]+/g, '[REDACTED_KEY]')
    .replace(/https:\/\/[^@\s]+@/g, 'https://[REDACTED]@');

  const statusCode = lastError?.status || lastError?.code;

  if (statusCode === 401 || sanitizedMsg.includes('API_KEY_INVALID') || sanitizedMsg.includes('401')) {
    return {
      status: 'AUTH_ERROR',
      model: modelName,
      error: `GEMINI_AUTH_FAILED: Authentication failed (401). Invalid API key.`,
    };
  }

  if (statusCode === 403 || sanitizedMsg.includes('403')) {
    return {
      status: 'AUTH_ERROR',
      model: modelName,
      error: `GEMINI_PERMISSION_DENIED: Access restricted or permission denied (403).`,
    };
  }

  if (
    statusCode === 429 ||
    sanitizedMsg.includes('429') ||
    sanitizedMsg.includes('RESOURCE_EXHAUSTED') ||
    sanitizedMsg.toLowerCase().includes('quota') ||
    sanitizedMsg.toLowerCase().includes('rate limit')
  ) {
    return {
      status: 'QUOTA_LIMITED',
      model: modelName,
      error: 'GEMINI_QUOTA_EXCEEDED: Model rate limit or quota exceeded (429).',
    };
  }

  if (statusCode === 503 || sanitizedMsg.includes('503') || sanitizedMsg.toLowerCase().includes('high demand')) {
    return {
      status: 'WARNING',
      model: modelName,
      error: 'GEMINI_HIGH_DEMAND: Model is currently experiencing high demand (503). Spikes are temporary.',
    };
  }

  if (statusCode === 400 || sanitizedMsg.includes('400')) {
    return {
      status: 'ERROR',
      model: modelName,
      error: `GEMINI_REQUEST_ERROR: Bad request or unsupported configuration (400).`,
    };
  }

  return {
    status: 'ERROR',
    model: modelName,
    error: sanitizedMsg.slice(0, 200),
  };
}

/**
 * V3 Simple Targeted Response Schema
 */
const V3_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    laptop: {
      type: Type.OBJECT,
      properties: {
        brand: { type: Type.STRING, description: 'Brand manufacturer name, e.g. Lenovo, Asus, Apple, Dell, HP' },
        model: { type: Type.STRING, description: 'Specific model name, e.g. Legion Pro 7i, Zephyrus G16, MacBook Pro 16' },
        series: { type: Type.STRING, description: 'Series name if any, e.g. Legion, ROG, XPS or null' },
        generation: { type: Type.STRING, description: 'Generation or release year if mentioned, e.g. Gen 9, 2024 or null' },
      },
      required: ['brand', 'model'],
    },
    configuration: {
      type: Type.OBJECT,
      properties: {
        cpu: { type: Type.STRING, description: 'Exact processor tested, e.g. Intel Core i9-14900HX, AMD Ryzen 9 8945HS, Apple M3 Max or null' },
        gpu: { type: Type.STRING, description: 'Exact graphics card tested, e.g. NVIDIA GeForce RTX 4080 Laptop GPU or null' },
        gpu_type: { type: Type.STRING, enum: ['integrated', 'dedicated', 'unknown'], description: 'dedicated, integrated, or unknown' },
        gpu_tgp_w: { type: Type.INTEGER, description: 'GPU Total Graphics Power in watts if explicitly stated, or null' },
        ram_gb: { type: Type.INTEGER, description: 'RAM capacity in GB as tested, e.g. 16, 32, 64 or null' },
        ram_speed_mt_s: { type: Type.INTEGER, description: 'RAM speed in MT/s if stated, or null' },
        storage_gb: { type: Type.INTEGER, description: 'Storage capacity in GB as tested, e.g. 1024 for 1TB, 2048 for 2TB or null' },
        storage_type: { type: Type.STRING, description: 'Storage type, e.g. NVMe PCIe 4.0 SSD or null' },
        ssd_read_mb_s: { type: Type.NUMBER, description: 'Measured SSD sequential read speed in MB/s if CrystalDiskMark/storage benchmark was shown, or null' },
        ssd_write_mb_s: { type: Type.NUMBER, description: 'Measured SSD sequential write speed in MB/s if CrystalDiskMark/storage benchmark was shown, or null' },
        display_size_inch: { type: Type.NUMBER, description: 'Screen size diagonal in inches, e.g. 16.0, 14.5 or null' },
        display_resolution: { type: Type.STRING, description: 'Native resolution, e.g. 2560x1600, 1920x1080 or null' },
        refresh_rate_hz: { type: Type.INTEGER, description: 'Display refresh rate in Hz, e.g. 165, 240, 120 or null' },
        panel_type: { type: Type.STRING, description: 'Panel technology, e.g. IPS, OLED, Mini-LED or null' },
        battery_wh: { type: Type.NUMBER, description: 'Battery capacity in Watt-hours (Wh), e.g. 99.9, 80 or null' },
        weight_kg: { type: Type.NUMBER, description: 'Weight in kilograms if measured/stated, or null' },
        thickness_mm: { type: Type.NUMBER, description: 'Thickness in millimeters if measured/stated, or null' },
        webcam: { type: Type.STRING, description: 'Webcam specification, e.g. 1080p, 720p, 1080p + IR, 5MP or null' },
        build_quality: { type: Type.STRING, description: 'Concise source-grounded note on chassis build quality and hinge flex, or null' },
      },
    },
    review_meta: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Video title' },
        reviewer: { type: Type.STRING, description: 'Reviewer name or YouTube channel name' },
        published_date: { type: Type.STRING, description: 'Publication date if found, or null' },
        verdict_summary: { type: Type.STRING, description: 'Concise summary of reviewer verdict and conclusion' },
        verdict_pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Top positive points (maximum 5)' },
        verdict_cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Top negative points (maximum 5)' },
      },
      required: ['title', 'reviewer'],
    },
    benchmarks: {
      type: Type.ARRAY,
      description: 'Maximum 8 benchmark rows. Only extract Cinebench R23, Cinebench 2024, Geekbench 6, 3DMark Time Spy, PCMark 10, CrystalDiskMark if shown.',
      items: {
        type: Type.OBJECT,
        properties: {
          benchmark_name: { type: Type.STRING, description: 'Benchmark family name, e.g. Cinebench R23, Geekbench 6, 3DMark Time Spy' },
          benchmark_version: { type: Type.STRING, description: 'Version, e.g. R23, 2024, 6 or null' },
          variant: { type: Type.STRING, description: 'Variant, e.g. Multi-Core, Single-Core, Graphics Score, Overall or null' },
          category: { type: Type.STRING, enum: ['cpu', 'gpu', 'storage', 'system'], description: 'Category: cpu, gpu, storage, or system' },
          score: { type: Type.NUMBER, description: 'Exact measured numeric score. Set to null if unreadable. NEVER zero.' },
          unit: { type: Type.STRING, description: 'Score unit, e.g. pts, MB/s or null' },
          power_mode: { type: Type.STRING, description: 'Power mode during test, e.g. Turbo, Balanced, Performance or null' },
          source_timestamp: { type: Type.STRING, description: 'Video timestamp where shown, e.g. "12:34" or null' },
          notes: { type: Type.STRING, description: 'Brief test note or null' },
        },
        required: ['benchmark_name', 'category'],
      },
    },
    gaming: {
      type: Type.ARRAY,
      description: 'Maximum 5 unique game titles. Prefer: GTA V Enhanced, Black Myth: Wukong, Cyberpunk 2077, Red Dead Redemption 2, Hogwarts Legacy if shown.',
      items: {
        type: Type.OBJECT,
        properties: {
          game: { type: Type.STRING, description: 'Game title, e.g. Cyberpunk 2077, Black Myth: Wukong' },
          resolution: { type: Type.STRING, description: 'Resolution tested, e.g. 1920x1080, 2560x1440, 2560x1600 or null' },
          preset: { type: Type.STRING, description: 'Graphics preset, e.g. Ultra, High, Medium or null' },
          ray_tracing: { type: Type.BOOLEAN, description: 'Whether ray tracing was ON or null' },
          upscaling: { type: Type.BOOLEAN, description: 'Whether DLSS/FSR was ON or null' },
          upscaling_mode: { type: Type.STRING, description: 'Upscaling mode, e.g. Quality, Balanced or null' },
          frame_generation: { type: Type.BOOLEAN, description: 'Whether Frame Generation was enabled or null' },
          avg_fps: { type: Type.NUMBER, description: 'Average frames per second. NEVER fabricate. Set to null if unreadable.' },
          one_percent_low_fps: { type: Type.NUMBER, description: '1% low FPS if shown, or null' },
          source_timestamp: { type: Type.STRING, description: 'Video timestamp where shown, e.g. "08:15" or null' },
          notes: { type: Type.STRING, description: 'Brief test note or null' },
        },
        required: ['game'],
      },
    },
    thermals: {
      type: Type.ARRAY,
      description: 'Basic thermal data: peak CPU/GPU temps and keyboard hotspot.',
      items: {
        type: Type.OBJECT,
        properties: {
          test_name: { type: Type.STRING, description: 'Workload/test name, e.g. Combined Stress Test, Cinebench Loop' },
          cpu_peak_c: { type: Type.NUMBER, description: 'CPU maximum recorded temp in Celsius or null' },
          gpu_peak_c: { type: Type.NUMBER, description: 'GPU maximum recorded temp in Celsius or null' },
          keyboard_max_c: { type: Type.NUMBER, description: 'Keyboard surface hotspot temp in Celsius or null' },
          cpu_peak_power_w: { type: Type.NUMBER, description: 'CPU peak package wattage or null' },
          gpu_peak_power_w: { type: Type.NUMBER, description: 'GPU peak wattage or null' },
          fan_noise_db: { type: Type.NUMBER, description: 'Fan noise in decibels or null' },
          source_timestamp: { type: Type.STRING, description: 'Video timestamp or null' },
          notes: { type: Type.STRING, description: 'Thermal notes or null' },
        },
        required: ['test_name'],
      },
    },
    display: {
      type: Type.OBJECT,
      properties: {
        brightness_sdr_nits: { type: Type.NUMBER, description: 'Measured peak SDR brightness in nits or null' },
        brightness_hdr_nits: { type: Type.NUMBER, description: 'Measured peak HDR brightness in nits or null' },
        srgb_percent: { type: Type.NUMBER, description: 'sRGB color gamut percentage or null' },
        dci_p3_percent: { type: Type.NUMBER, description: 'DCI-P3 color gamut percentage or null' },
        response_time_ms: { type: Type.NUMBER, description: 'Response time in ms or null' },
        contrast_ratio: { type: Type.STRING, description: 'Contrast ratio, e.g. "1200:1" or null' },
        notes: { type: Type.STRING, description: 'Display notes or null' },
      },
    },
    battery: {
      type: Type.OBJECT,
      properties: {
        battery_wh: { type: Type.NUMBER, description: 'Battery capacity in Wh or null' },
        battery_life_hours: { type: Type.NUMBER, description: 'Battery runtime in hours or null' },
        test_method: { type: Type.STRING, description: 'Workload method, e.g. YouTube 1080p playback, PCMark 10 or null' },
        charging_adapter_w: { type: Type.NUMBER, description: 'Included charger wattage in Watts or null' },
        usb_c_charging_w: { type: Type.NUMBER, description: 'Supported USB-C charging wattage or null' },
        full_charge_min: { type: Type.NUMBER, description: 'Time in minutes to reach 100% full charge or null' },
        notes: { type: Type.STRING, description: 'Battery notes or null' },
      },
    },
  },
  required: ['laptop', 'configuration', 'review_meta'],
};

/**
 * Fetch official YouTube oEmbed metadata for ground truth title & author
 */
export async function fetchYouTubeOEmbed(youtubeUrl: string): Promise<{
  title: string;
  author_name: string;
  thumbnail_url: string;
} | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * V3 Single Targeted Gemini Extraction Request
 * - 1 targeted request
 * - Max 1 retry on transient network error
 * - Zero guessing (missing data -> null)
 * - Strict Zod validation + normalization
 */
export async function extractLaptopDataWithGemini(
  youtubeUrl: string,
  videoId: string,
  modelOverride?: string
): Promise<{
  payload: ExtractedDataPayload;
  modelUsed: string;
  durationMs: number;
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_NOT_CONFIGURED: GEMINI_API_KEY environment variable is not set.');
  }

  const model = modelOverride?.trim() || getGeminiModelName();
  const startTime = Date.now();
  const oembed = await fetchYouTubeOEmbed(youtubeUrl);
  const ai = getGeminiClient();

  const systemInstruction = `You are extracting comparison data from the supplied YouTube laptop review video.
Use ONLY the supplied video as the source.
Do not use outside knowledge.
Do not guess or assume.
If a value is not actually shown or clearly stated in the video, return null.
Never convert missing scores or missing values into 0.
Extract only the fields requested by the JSON schema.
Focus on the exact laptop/configuration shown in this review.

Target benchmarks (max 8): ${TARGET_BENCHMARK_FAMILIES.join(', ')}.
Target games (max 5): ${PRIORITY_GAMES.join(', ')}. Pick 1 primary comparison setting per game.
Capture CPU/GPU peak thermals, basic display & battery measurements, and concise build quality.
Return structured JSON only.`;

  const userPrompt = `Extract structured comparison hardware specifications, benchmarks, gaming performance, thermals, display, battery, and review verdict from this YouTube review:
Video URL: ${youtubeUrl}
Video ID: ${videoId}
${oembed ? `Verified Title: "${oembed.title}"\nVerified Reviewer/Channel: "${oembed.author_name}"` : ''}

Extract only verified measurements and facts present in this video.`;

  let responseText: string | undefined;

  try {
    const parts: any[] = [{ text: userPrompt }];
    try {
      parts.unshift({
        fileData: {
          fileUri: youtubeUrl,
          mimeType: 'video/mp4',
        },
      });
    } catch {
      // Fall back to prompt text
    }

    const result = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: V3_EXTRACTION_SCHEMA,
        temperature: 0.1,
      },
    });

    responseText = result.text;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    if (
      err?.status === 429 ||
      errorMsg.includes('429') ||
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      errorMsg.toLowerCase().includes('quota')
    ) {
      throw new Error('RATE LIMITED: Gemini model quota exceeded. Please retry shortly.');
    }

    // Attempt 1 single fallback retry with URL context
    console.warn(`[Gemini Extraction] Initial video attachment attempt failed: ${errorMsg}. Retrying once with video prompt...`);
    try {
      const fallbackResult = await ai.models.generateContent({
        model,
        contents: `${userPrompt}\n\nInspect the YouTube review at ${youtubeUrl} and extract structured data conforming to the schema.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: V3_EXTRACTION_SCHEMA,
          temperature: 0.1,
        },
      });
      responseText = fallbackResult.text;
    } catch (fallbackErr: any) {
      const fallbackMsg = fallbackErr?.message || String(fallbackErr);
      if (
        fallbackErr?.status === 429 ||
        fallbackMsg.includes('429') ||
        fallbackMsg.includes('RESOURCE_EXHAUSTED') ||
        fallbackMsg.toLowerCase().includes('quota')
      ) {
        throw new Error('RATE LIMITED: Gemini model quota exceeded. Please retry shortly.');
      }
      const cleanError = fallbackMsg.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]').replace(/AQ\.[A-Za-z0-9_-]+/g, '[REDACTED_KEY]');
      throw new Error(`GEMINI_EXTRACTION_FAILED: ${cleanError}`);
    }
  }

  const durationMs = Date.now() - startTime;

  if (!responseText || responseText.trim().length === 0) {
    throw new Error('GEMINI_EXTRACTION_FAILED: Model returned empty response.');
  }

  let rawJson: any;
  try {
    rawJson = JSON.parse(responseText.trim());
  } catch (parseErr: any) {
    throw new Error(`GEMINI_SCHEMA_ERROR: Could not parse response as JSON: ${parseErr.message}`);
  }

  // Enrich with verified oEmbed metadata if available
  if (oembed) {
    if (!rawJson.review_meta) rawJson.review_meta = {};
    if (!rawJson.review_meta.title || rawJson.review_meta.title.toLowerCase().includes('untitled')) {
      rawJson.review_meta.title = oembed.title;
    }
    if (!rawJson.review_meta.reviewer || rawJson.review_meta.reviewer.toLowerCase().includes('unknown')) {
      rawJson.review_meta.reviewer = oembed.author_name;
    }
  }

  rawJson.review_meta = {
    ...rawJson.review_meta,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
  };

  const normalized = normalizeExtractionInput(rawJson);
  const parsed = ExtractedDataPayloadSchema.safeParse(normalized);
  if (!parsed.success) {
    console.error('Validation errors:', parsed.error.format());
    throw new Error(`GEMINI_SCHEMA_ERROR: Schema validation failed: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
  }

  return {
    payload: parsed.data as ExtractedDataPayload,
    modelUsed: model,
    durationMs,
  };
}
