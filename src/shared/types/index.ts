export type BenchmarkCategory = 'cpu' | 'gpu' | 'storage' | 'system';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'ready_for_review'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'duplicate';

export type RetailerType = 'amazon' | 'flipkart';
export type GpuType = 'integrated' | 'dedicated' | 'unknown';

export interface LaptopBrand {
  id: string;
  name: string;
  created_at?: string;
}

export interface Laptop {
  id: string;
  brand: string;
  brand_id?: string;
  model: string;
  series: string | null;
  generation: string | null;
  created_at?: string;
}

export interface BenchmarkResult {
  id?: string;
  review_source_id?: string;
  benchmark_name: string;
  benchmark_group?: string; // alias for backwards compatibility
  benchmark_version?: string | null;
  variant?: string | null;
  category: BenchmarkCategory;
  score: number | null;
  unit?: string | null;
  power_mode?: string | null;
  source_timestamp?: string | null;
  notes?: string | null;
}

export interface GamingResult {
  id?: string;
  review_source_id?: string;
  game: string;
  resolution?: string | null;
  preset?: string | null;
  ray_tracing?: boolean | null;
  upscaling?: boolean | null;
  upscaling_mode?: string | null;
  frame_generation?: boolean | null;
  avg_fps: number | null;
  one_percent_low_fps?: number | null;
  source_timestamp?: string | null;
  notes?: string | null;
}

export interface ThermalResult {
  id?: string;
  review_source_id?: string;
  test_name: string;
  cpu_peak_c?: number | null;
  gpu_peak_c?: number | null;
  keyboard_max_c?: number | null;
  cpu_peak_power_w?: number | null;
  gpu_peak_power_w?: number | null;
  fan_noise_db?: number | null;
  source_timestamp?: string | null;
  notes?: string | null;
}

export interface DisplayResult {
  id?: string;
  review_source_id?: string;
  brightness_sdr_nits?: number | null;
  brightness_hdr_nits?: number | null;
  srgb_percent?: number | null;
  dci_p3_percent?: number | null;
  response_time_ms?: number | null;
  contrast_ratio?: string | null;
  notes?: string | null;
}

export interface BatteryResult {
  id?: string;
  review_source_id?: string;
  battery_wh?: number | null;
  battery_life_hours?: number | null;
  test_method?: string | null;
  charging_adapter_w?: number | null;
  usb_c_charging_w?: number | null;
  full_charge_min?: number | null;
  notes?: string | null;
}

export interface ReviewSource {
  id: string;
  configuration_id: string;
  youtube_url: string;
  youtube_video_id: string;
  title: string;
  reviewer: string;
  published_date: string | null;
  verdict_summary: string | null;
  verdict_pros: string[];
  verdict_cons: string[];
  raw_data?: Record<string, unknown> | null;
  created_at?: string;
}

export interface ProductListing {
  id: string;
  configuration_id: string;
  retailer: RetailerType;
  product_url: string | null;
  image_url: string | null;
  current_price: number | null;
  currency: string;
  in_stock: boolean | null;
  last_checked_at?: string | null;
  created_at?: string;
}

export interface Configuration {
  id: string;
  laptop_id: string;
  cpu: string | null;
  gpu: string | null;
  gpu_type: GpuType | null;
  gpu_tgp_w: number | null;
  ram_gb: number | null;
  ram_speed_mt_s: number | null;
  storage_gb: number | null;
  storage_type: string | null;
  ssd_read_mb_s: number | null;
  ssd_write_mb_s: number | null;
  display_size_inch: number | null;
  display_resolution: string | null;
  refresh_rate_hz: number | null;
  panel_type: string | null;
  battery_wh: number | null;
  weight_kg: number | null;
  thickness_mm: number | null;
  webcam: string | null;
  build_quality: string | null;
  created_at?: string;
  laptop?: Laptop;
  review_count?: number;
  review_sources?: ReviewSource[];
  benchmark_results?: BenchmarkResult[];
  gaming_results?: GamingResult[];
  thermal_results?: ThermalResult[];
  display_results?: DisplayResult[];
  battery_results?: BatteryResult[];
  product_listings?: ProductListing[];
}

export interface ExtractedDataPayload {
  laptop: {
    brand: string;
    model: string;
    series?: string | null;
    generation?: string | null;
  };
  configuration: {
    cpu?: string | null;
    gpu?: string | null;
    gpu_type?: GpuType | null;
    gpu_tgp_w?: number | null;
    ram_gb?: number | null;
    ram_speed_mt_s?: number | null;
    storage_gb?: number | null;
    storage_type?: string | null;
    ssd_read_mb_s?: number | null;
    ssd_write_mb_s?: number | null;
    display_size_inch?: number | null;
    display_resolution?: string | null;
    refresh_rate_hz?: number | null;
    panel_type?: string | null;
    battery_wh?: number | null;
    weight_kg?: number | null;
    thickness_mm?: number | null;
    webcam?: string | null;
    build_quality?: string | null;
  };
  review_meta: {
    title: string;
    reviewer: string;
    published_date?: string | null;
    verdict_summary?: string | null;
    verdict_pros?: string[];
    verdict_cons?: string[];
    youtube_url?: string;
    youtube_video_id?: string;
  };
  benchmarks: BenchmarkResult[];
  gaming: GamingResult[];
  thermals: ThermalResult[];
  display?: DisplayResult | null;
  battery?: BatteryResult | null;
}

export interface ExtractionJob {
  id: string;
  youtube_url: string;
  youtube_video_id: string;
  status: JobStatus;
  raw_extraction: ExtractedDataPayload | null;
  error_message: string | null;
  review_source_id: string | null;
  attempt_count: number;
  last_started_at?: string | null;
  completed_at?: string | null;
  model_used: string | null;
  processing_duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export type MatchClassification = 'EXACT MATCH' | 'LIKELY MATCH' | 'PARTIAL MATCH' | 'NO MATCH';

export interface ConfigurationMatchResult {
  classification: MatchClassification;
  confidenceScore: number;
  matchedConfiguration: Configuration | null;
  matchedLaptop: Laptop | null;
  matchedBrand: LaptopBrand | null;
  matchingReasons: string[];
  differingFields: string[];
}

export type ServiceState =
  | 'LIVE'
  | 'ERROR'
  | 'WARNING'
  | 'NOT_CONFIGURED'
  | 'UNREACHABLE'
  | 'AUTH_ERROR'
  | 'DATABASE_ERROR'
  | 'QUOTA_LIMITED'
  | 'SCHEMA_MISMATCH';

export interface SystemStatusResponse {
  application: {
    name: string;
    version: string;
    environment: string;
    status: ServiceState;
  };
  gemini: {
    status: ServiceState;
    model: string;
    latencyMs?: number;
    error?: string;
  };
  supabase: {
    status: ServiceState;
    reachable: boolean;
    connectionStatus?: ServiceState;
    schemaStatus?: 'HEALTHY' | 'SCHEMA_MISMATCH' | 'ERROR' | 'NOT_CONFIGURED';
    latencyMs?: number;
    error?: string;
  };
  authentication: {
    adminKeyConfigured: boolean;
  };
  timestamp: string;
}

export type UserRole = 'viewer' | 'reviewer' | 'admin';

export interface UserProfile {
  id: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthContextUser {
  id: string;
  email?: string;
  role: UserRole;
  displayName: string;
  isActive: boolean;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportsGenerateContent: boolean;
  videoCapability: 'VERIFIED' | 'CAPABILITY_UNVERIFIED' | 'UNSUPPORTED';
  supportsStructuredJson: boolean;
  releaseClass: 'stable' | 'preview' | 'experimental';
  status?: string;
  latencyMs?: number;
  lastTestedAt?: string;
  error?: string;
}
