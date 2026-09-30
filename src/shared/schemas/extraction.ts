import { z } from 'zod';
import {
  APP_CONFIG,
  BENCHMARK_CATEGORIES,
  PRIORITY_GAMES,
  TARGET_BENCHMARK_FAMILIES,
} from '../constants/index.ts';

// Helper to coerce string / invalid numbers to number or null
const coerceNullableNumber = z.preprocess((val) => {
  if (val === null || val === undefined || val === '' || val === 'null') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}, z.number().nullable().optional());

// Helper to coerce string or null
const coerceNullableString = z.preprocess((val) => {
  if (val === null || val === undefined || val === 'null') return null;
  const str = String(val).trim();
  return str.length === 0 ? null : str;
}, z.string().nullable().optional());

// Helper to coerce boolean or null
const coerceNullableBoolean = z.preprocess((val) => {
  if (val === null || val === undefined || val === 'null' || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'true' || lower === 'yes' || lower === 'on') return true;
    if (lower === 'false' || lower === 'no' || lower === 'off') return false;
  }
  return null;
}, z.boolean().nullable().optional());

export const LaptopSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  series: coerceNullableString,
  generation: coerceNullableString,
});

export const ConfigurationSchema = z.object({
  cpu: coerceNullableString,
  gpu: coerceNullableString,
  gpu_type: z.enum(['integrated', 'dedicated', 'unknown']).nullable().optional().default('unknown'),
  gpu_tgp_w: coerceNullableNumber,
  ram_gb: coerceNullableNumber,
  ram_speed_mt_s: coerceNullableNumber,
  storage_gb: coerceNullableNumber,
  storage_type: coerceNullableString,
  ssd_read_mb_s: coerceNullableNumber,
  ssd_write_mb_s: coerceNullableNumber,
  display_size_inch: coerceNullableNumber,
  display_resolution: coerceNullableString,
  refresh_rate_hz: coerceNullableNumber,
  panel_type: coerceNullableString,
  battery_wh: coerceNullableNumber,
  weight_kg: coerceNullableNumber,
  thickness_mm: coerceNullableNumber,
  webcam: coerceNullableString,
  build_quality: coerceNullableString,
});

export const ReviewMetaSchema = z.object({
  title: z.string().default('Untitled Review'),
  reviewer: z.string().default('Unknown Reviewer'),
  published_date: coerceNullableString,
  verdict_summary: coerceNullableString,
  verdict_pros: z.array(z.string()).default([]),
  verdict_cons: z.array(z.string()).default([]),
  youtube_url: coerceNullableString,
  youtube_video_id: coerceNullableString,
});

export const BenchmarkResultSchema = z.object({
  benchmark_name: z.string().min(1, 'Benchmark name is required'),
  benchmark_group: coerceNullableString,
  benchmark_version: coerceNullableString,
  variant: coerceNullableString,
  category: z.enum(['cpu', 'gpu', 'storage', 'system']).default('system'),
  score: coerceNullableNumber,
  unit: coerceNullableString,
  power_mode: coerceNullableString,
  source_timestamp: coerceNullableString,
  notes: coerceNullableString,
});

export const GamingResultSchema = z.object({
  game: z.string().min(1, 'Game title is required'),
  resolution: coerceNullableString,
  preset: coerceNullableString,
  ray_tracing: coerceNullableBoolean,
  upscaling: coerceNullableBoolean,
  upscaling_mode: coerceNullableString,
  frame_generation: coerceNullableBoolean,
  avg_fps: coerceNullableNumber,
  one_percent_low_fps: coerceNullableNumber,
  source_timestamp: coerceNullableString,
  notes: coerceNullableString,
});

export const ThermalResultSchema = z.object({
  test_name: z.string().default('Thermal Stress Test'),
  cpu_peak_c: coerceNullableNumber,
  gpu_peak_c: coerceNullableNumber,
  keyboard_max_c: coerceNullableNumber,
  cpu_peak_power_w: coerceNullableNumber,
  gpu_peak_power_w: coerceNullableNumber,
  fan_noise_db: coerceNullableNumber,
  source_timestamp: coerceNullableString,
  notes: coerceNullableString,
});

export const DisplayResultSchema = z.object({
  brightness_sdr_nits: coerceNullableNumber,
  brightness_hdr_nits: coerceNullableNumber,
  srgb_percent: coerceNullableNumber,
  dci_p3_percent: coerceNullableNumber,
  response_time_ms: coerceNullableNumber,
  contrast_ratio: coerceNullableString,
  notes: coerceNullableString,
});

export const BatteryResultSchema = z.object({
  battery_wh: coerceNullableNumber,
  battery_life_hours: coerceNullableNumber,
  test_method: coerceNullableString,
  charging_adapter_w: coerceNullableNumber,
  usb_c_charging_w: coerceNullableNumber,
  full_charge_min: coerceNullableNumber,
  notes: coerceNullableString,
});

export const ExtractedDataPayloadSchema = z.object({
  laptop: LaptopSchema,
  configuration: ConfigurationSchema,
  review_meta: ReviewMetaSchema,
  benchmarks: z.array(BenchmarkResultSchema).default([]),
  gaming: z.array(GamingResultSchema).default([]),
  thermals: z.array(ThermalResultSchema).default([]),
  display: DisplayResultSchema.nullable().optional(),
  battery: BatteryResultSchema.nullable().optional(),
});

export const CommitPayloadSchema = z.object({
  data: ExtractedDataPayloadSchema,
  useExistingConfigId: z.string().nullable().optional(),
  reviewerIdentity: z.string().optional(),
  retailListings: z
    .object({
      amazonUrl: coerceNullableString,
      flipkartUrl: coerceNullableString,
      manualImageUrl: coerceNullableString,
      amazonManualPrice: coerceNullableNumber,
      flipkartManualPrice: coerceNullableNumber,
    })
    .optional(),
});

/**
 * Normalizes raw Gemini JSON output into conformant V3 data
 */
export function normalizeExtractionInput(raw: any): any {
  if (!raw || typeof raw !== 'object') return {};

  const normalized: any = {
    laptop: {
      brand: String(raw.laptop?.brand || '').trim() || 'Unknown Brand',
      model: String(raw.laptop?.model || '').trim() || 'Unknown Model',
      series: raw.laptop?.series ? String(raw.laptop.series).trim() : null,
      generation: raw.laptop?.generation ? String(raw.laptop.generation).trim() : null,
    },
    configuration: {
      cpu: raw.configuration?.cpu ? String(raw.configuration.cpu).trim() : null,
      gpu: raw.configuration?.gpu ? String(raw.configuration.gpu).trim() : null,
      gpu_type: raw.configuration?.gpu_type === 'integrated' || raw.configuration?.gpu_type === 'dedicated'
        ? raw.configuration.gpu_type
        : 'unknown',
      gpu_tgp_w: raw.configuration?.gpu_tgp_w ?? null,
      ram_gb: raw.configuration?.ram_gb ?? null,
      ram_speed_mt_s: raw.configuration?.ram_speed_mt_s ?? null,
      storage_gb: raw.configuration?.storage_gb ?? null,
      storage_type: raw.configuration?.storage_type ? String(raw.configuration.storage_type).trim() : null,
      ssd_read_mb_s: raw.configuration?.ssd_read_mb_s ?? null,
      ssd_write_mb_s: raw.configuration?.ssd_write_mb_s ?? null,
      display_size_inch: raw.configuration?.display_size_inch ?? null,
      display_resolution: raw.configuration?.display_resolution ? String(raw.configuration.display_resolution).trim() : null,
      refresh_rate_hz: raw.configuration?.refresh_rate_hz ?? null,
      panel_type: raw.configuration?.panel_type ? String(raw.configuration.panel_type).trim() : null,
      battery_wh: raw.configuration?.battery_wh ?? null,
      weight_kg: raw.configuration?.weight_kg ?? null,
      thickness_mm: raw.configuration?.thickness_mm ?? null,
      webcam: raw.configuration?.webcam ? String(raw.configuration.webcam).trim() : null,
      build_quality: raw.configuration?.build_quality ? String(raw.configuration.build_quality).trim() : null,
    },
    review_meta: {
      title: String(raw.review_meta?.title || 'YouTube Review').trim(),
      reviewer: String(raw.review_meta?.reviewer || 'Reviewer').trim(),
      published_date: raw.review_meta?.published_date ? String(raw.review_meta.published_date).trim() : null,
      verdict_summary: raw.review_meta?.verdict_summary ? String(raw.review_meta.verdict_summary).trim() : null,
      verdict_pros: Array.isArray(raw.review_meta?.verdict_pros)
        ? raw.review_meta.verdict_pros.map(String).slice(0, APP_CONFIG.maxProsCons)
        : [],
      verdict_cons: Array.isArray(raw.review_meta?.verdict_cons)
        ? raw.review_meta.verdict_cons.map(String).slice(0, APP_CONFIG.maxProsCons)
        : [],
      youtube_url: raw.review_meta?.youtube_url ? String(raw.review_meta.youtube_url).trim() : undefined,
      youtube_video_id: raw.review_meta?.youtube_video_id ? String(raw.review_meta.youtube_video_id).trim() : undefined,
    },
    benchmarks: [],
    gaming: [],
    thermals: [],
    display: null,
    battery: null,
  };

  // Normalize benchmarks (capped to max 8)
  if (Array.isArray(raw.benchmarks)) {
    normalized.benchmarks = raw.benchmarks
      .filter((b: any) => b && (b.benchmark_name || b.benchmark_group))
      .slice(0, APP_CONFIG.maxBenchmarksCount)
      .map((b: any) => {
        const name = String(b.benchmark_name || b.benchmark_group || '').trim();
        let cat = String(b.category || 'system').toLowerCase();
        if (!BENCHMARK_CATEGORIES.includes(cat as any)) {
          cat = 'system';
        }
        return {
          benchmark_name: name,
          benchmark_group: name,
          benchmark_version: b.benchmark_version ? String(b.benchmark_version).trim() : null,
          variant: b.variant ? String(b.variant).trim() : null,
          category: cat,
          score: typeof b.score === 'number' && !isNaN(b.score) ? b.score : null,
          unit: b.unit ? String(b.unit).trim() : null,
          power_mode: b.power_mode ? String(b.power_mode).trim() : null,
          source_timestamp: b.source_timestamp ? String(b.source_timestamp).trim() : null,
          notes: b.notes ? String(b.notes).trim() : null,
        };
      });
  }

  // Normalize gaming (capped to max 5 unique game titles, 1 primary result per game)
  if (Array.isArray(raw.gaming)) {
    const seenGames = new Set<string>();
    const uniqueGames: any[] = [];

    // Prioritize configured priority games first
    const sortedGaming = [...raw.gaming].sort((a: any, b: any) => {
      const aName = String(a?.game || '').toLowerCase();
      const bName = String(b?.game || '').toLowerCase();
      const aIsPriority = PRIORITY_GAMES.some((p) => aName.includes(p.toLowerCase()));
      const bIsPriority = PRIORITY_GAMES.some((p) => bName.includes(p.toLowerCase()));
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return 0;
    });

    for (const g of sortedGaming) {
      if (!g || !g.game) continue;
      const title = String(g.game).trim();
      const titleKey = title.toLowerCase();
      if (seenGames.has(titleKey)) continue;
      seenGames.add(titleKey);

      uniqueGames.push({
        game: title,
        resolution: g.resolution ? String(g.resolution).trim() : null,
        preset: g.preset ? String(g.preset).trim() : null,
        ray_tracing: typeof g.ray_tracing === 'boolean' ? g.ray_tracing : null,
        upscaling: typeof g.upscaling === 'boolean' ? g.upscaling : null,
        upscaling_mode: g.upscaling_mode ? String(g.upscaling_mode).trim() : null,
        frame_generation: typeof g.frame_generation === 'boolean' ? g.frame_generation : null,
        avg_fps: typeof g.avg_fps === 'number' && !isNaN(g.avg_fps) ? g.avg_fps : null,
        one_percent_low_fps: typeof g.one_percent_low_fps === 'number' && !isNaN(g.one_percent_low_fps) ? g.one_percent_low_fps : null,
        source_timestamp: g.source_timestamp ? String(g.source_timestamp).trim() : null,
        notes: g.notes ? String(g.notes).trim() : null,
      });

      if (uniqueGames.length >= APP_CONFIG.maxGamesCount) break;
    }
    normalized.gaming = uniqueGames;
  }

  // Normalize thermals
  if (Array.isArray(raw.thermals)) {
    normalized.thermals = raw.thermals
      .filter((t: any) => t && (t.test_name || t.cpu_peak_c || t.gpu_peak_c))
      .slice(0, 3)
      .map((t: any) => ({
        test_name: String(t.test_name || 'Thermal Test').trim(),
        cpu_peak_c: typeof t.cpu_peak_c === 'number' && !isNaN(t.cpu_peak_c) ? t.cpu_peak_c : null,
        gpu_peak_c: typeof t.gpu_peak_c === 'number' && !isNaN(t.gpu_peak_c) ? t.gpu_peak_c : null,
        keyboard_max_c: typeof t.keyboard_max_c === 'number' && !isNaN(t.keyboard_max_c) ? t.keyboard_max_c : null,
        cpu_peak_power_w: typeof t.cpu_peak_power_w === 'number' && !isNaN(t.cpu_peak_power_w) ? t.cpu_peak_power_w : null,
        gpu_peak_power_w: typeof t.gpu_peak_power_w === 'number' && !isNaN(t.gpu_peak_power_w) ? t.gpu_peak_power_w : null,
        fan_noise_db: typeof t.fan_noise_db === 'number' && !isNaN(t.fan_noise_db) ? t.fan_noise_db : null,
        source_timestamp: t.source_timestamp ? String(t.source_timestamp).trim() : null,
        notes: t.notes ? String(t.notes).trim() : null,
      }));
  }

  // Normalize display
  if (raw.display && typeof raw.display === 'object') {
    normalized.display = {
      brightness_sdr_nits: typeof raw.display.brightness_sdr_nits === 'number' ? raw.display.brightness_sdr_nits : null,
      brightness_hdr_nits: typeof raw.display.brightness_hdr_nits === 'number' ? raw.display.brightness_hdr_nits : null,
      srgb_percent: typeof raw.display.srgb_percent === 'number' ? raw.display.srgb_percent : null,
      dci_p3_percent: typeof raw.display.dci_p3_percent === 'number' ? raw.display.dci_p3_percent : null,
      response_time_ms: typeof raw.display.response_time_ms === 'number' ? raw.display.response_time_ms : null,
      contrast_ratio: raw.display.contrast_ratio ? String(raw.display.contrast_ratio).trim() : null,
      notes: raw.display.notes ? String(raw.display.notes).trim() : null,
    };
  }

  // Normalize battery
  if (raw.battery && typeof raw.battery === 'object') {
    normalized.battery = {
      battery_wh: typeof raw.battery.battery_wh === 'number' ? raw.battery.battery_wh : null,
      battery_life_hours: typeof raw.battery.battery_life_hours === 'number' ? raw.battery.battery_life_hours : null,
      test_method: raw.battery.test_method ? String(raw.battery.test_method).trim() : null,
      charging_adapter_w: typeof raw.battery.charging_adapter_w === 'number' ? raw.battery.charging_adapter_w : null,
      usb_c_charging_w: typeof raw.battery.usb_c_charging_w === 'number' ? raw.battery.usb_c_charging_w : null,
      full_charge_min: typeof raw.battery.full_charge_min === 'number' ? raw.battery.full_charge_min : null,
      notes: raw.battery.notes ? String(raw.battery.notes).trim() : null,
    };
  }

  return normalized;
}
