-- AI Laptop Review V3 — Simple Schema Definition
-- Reference standalone schema for fresh V3 environments

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Laptops
CREATE TABLE IF NOT EXISTS laptops (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand text NOT NULL,
  model text NOT NULL,
  series text,
  generation text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Configurations
CREATE TABLE IF NOT EXISTS configurations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  laptop_id uuid REFERENCES laptops(id) ON DELETE CASCADE NOT NULL,
  cpu text,
  gpu text,
  gpu_type text CHECK (gpu_type IN ('integrated', 'dedicated', 'unknown')),
  gpu_tgp_w integer,
  ram_gb integer,
  ram_speed_mt_s integer,
  storage_gb integer,
  storage_type text,
  ssd_read_mb_s numeric,
  ssd_write_mb_s numeric,
  display_size_inch numeric,
  display_resolution text,
  refresh_rate_hz integer,
  panel_type text,
  battery_wh numeric,
  weight_kg numeric,
  thickness_mm numeric,
  webcam text,
  build_quality text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Review Sources
CREATE TABLE IF NOT EXISTS review_sources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id uuid REFERENCES configurations(id) ON DELETE CASCADE NOT NULL,
  youtube_url text NOT NULL,
  youtube_video_id text UNIQUE NOT NULL,
  title text NOT NULL,
  reviewer text NOT NULL,
  published_date text,
  verdict_summary text,
  verdict_pros text[] DEFAULT '{}',
  verdict_cons text[] DEFAULT '{}',
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Benchmark Results (Max ~8 rows per review)
CREATE TABLE IF NOT EXISTS benchmark_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_source_id uuid REFERENCES review_sources(id) ON DELETE CASCADE NOT NULL,
  benchmark_name text NOT NULL,
  benchmark_version text,
  variant text,
  category text NOT NULL CHECK (category IN ('cpu', 'gpu', 'storage', 'system')),
  score numeric,
  unit text,
  power_mode text,
  source_timestamp text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Gaming Results (Max ~5 games per review)
CREATE TABLE IF NOT EXISTS gaming_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_source_id uuid REFERENCES review_sources(id) ON DELETE CASCADE NOT NULL,
  game text NOT NULL,
  resolution text,
  preset text,
  ray_tracing boolean,
  upscaling boolean,
  upscaling_mode text,
  frame_generation boolean,
  avg_fps numeric,
  one_percent_low_fps numeric,
  source_timestamp text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Thermal Results
CREATE TABLE IF NOT EXISTS thermal_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_source_id uuid REFERENCES review_sources(id) ON DELETE CASCADE NOT NULL,
  test_name text NOT NULL,
  cpu_peak_c numeric,
  gpu_peak_c numeric,
  keyboard_max_c numeric,
  cpu_peak_power_w numeric,
  gpu_peak_power_w numeric,
  fan_noise_db numeric,
  source_timestamp text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Display Results
CREATE TABLE IF NOT EXISTS display_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_source_id uuid REFERENCES review_sources(id) ON DELETE CASCADE NOT NULL,
  brightness_sdr_nits numeric,
  brightness_hdr_nits numeric,
  srgb_percent numeric,
  dci_p3_percent numeric,
  response_time_ms numeric,
  contrast_ratio text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Battery Results
CREATE TABLE IF NOT EXISTS battery_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_source_id uuid REFERENCES review_sources(id) ON DELETE CASCADE NOT NULL,
  battery_life_hours numeric,
  test_method text,
  charging_adapter_w numeric,
  usb_c_charging_w numeric,
  full_charge_min numeric,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Extraction Jobs
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  youtube_url text NOT NULL,
  youtube_video_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'ready_for_review', 'completed', 'failed', 'rejected', 'duplicate')),
  raw_extraction jsonb,
  error_message text,
  review_source_id uuid REFERENCES review_sources(id) ON DELETE SET NULL,
  attempt_count integer DEFAULT 0 NOT NULL,
  model_used text,
  processing_duration_ms integer,
  last_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Product Listings (Max 2 per config: Amazon, Flipkart)
CREATE TABLE IF NOT EXISTS product_listings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id uuid REFERENCES configurations(id) ON DELETE CASCADE NOT NULL,
  retailer text NOT NULL CHECK (retailer IN ('amazon', 'flipkart')),
  product_url text,
  image_url text,
  current_price numeric,
  currency text DEFAULT 'INR' NOT NULL,
  in_stock boolean,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_config_retailer UNIQUE (configuration_id, retailer)
);

-- 11. Price History (Append-only)
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id uuid REFERENCES product_listings(id) ON DELETE CASCADE NOT NULL,
  price numeric NOT NULL,
  checked_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_configurations_laptop_id ON configurations(laptop_id);
CREATE INDEX IF NOT EXISTS idx_review_sources_config_id ON review_sources(configuration_id);
CREATE INDEX IF NOT EXISTS idx_review_sources_video_id ON review_sources(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_source_id ON benchmark_results(review_source_id);
CREATE INDEX IF NOT EXISTS idx_gaming_results_source_id ON gaming_results(review_source_id);
CREATE INDEX IF NOT EXISTS idx_thermal_results_source_id ON thermal_results(review_source_id);
CREATE INDEX IF NOT EXISTS idx_display_results_source_id ON display_results(review_source_id);
CREATE INDEX IF NOT EXISTS idx_battery_results_source_id ON battery_results(review_source_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_product_listings_config ON product_listings(configuration_id);
