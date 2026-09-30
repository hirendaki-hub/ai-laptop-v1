import { getSupabaseClient } from '../external/supabase.ts';
import type { ExtractedDataPayload, RetailerType } from '../../shared/types/index.ts';

export interface CommitExtractionParams {
  jobId: string;
  data: ExtractedDataPayload;
  useExistingConfigId?: string | null;
  reviewerIdentity?: string;
  retailListings?: {
    amazonUrl?: string | null;
    flipkartUrl?: string | null;
    manualImageUrl?: string | null;
    amazonManualPrice?: number | null;
    flipkartManualPrice?: number | null;
  };
}

export interface CommitResult {
  status: string;
  review_source_id: string;
  configuration_id: string;
  laptop_id?: string;
}

export async function commitReviewedExtraction(params: CommitExtractionParams): Promise<CommitResult> {
  const client = getSupabaseClient();
  const { data, jobId, useExistingConfigId } = params;

  // 1. Verify job
  const { data: job, error: jobErr } = await client
    .from('extraction_jobs')
    .select('id, status, youtube_video_id, youtube_url')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const videoId = job.youtube_video_id;
  const videoUrl = job.youtube_url;

  // 2. Check duplicate review source
  const { data: existingReview } = await client
    .from('review_sources')
    .select('id, configuration_id')
    .eq('youtube_video_id', videoId)
    .maybeSingle();

  if (existingReview && job.status === 'completed') {
    return {
      status: 'idempotent_success',
      review_source_id: existingReview.id,
      configuration_id: existingReview.configuration_id,
    };
  }

  if (existingReview && existingReview.id !== job.id) {
    throw new Error(`DUPLICATE_VIDEO: A verified review for YouTube video ${videoId} already exists in the database.`);
  }

  let configurationId = useExistingConfigId;
  let laptopId: string | undefined;

  // 3. If no existing config selected, find or create laptop & configuration
  if (!configurationId) {
    const brandName = data.laptop.brand.trim();
    const modelName = data.laptop.model.trim();
    const series = data.laptop.series ? data.laptop.series.trim() : null;
    const generation = data.laptop.generation ? data.laptop.generation.trim() : null;

    // Optionally ensure brand exists in standalone laptop_brands table if present
    try {
      const { data: brandRow } = await client
        .from('laptop_brands')
        .select('id')
        .ilike('name', brandName)
        .maybeSingle();

      if (!brandRow) {
        await client
          .from('laptop_brands')
          .insert({ name: brandName });
      }
    } catch {
      // laptop_brands is optional standalone table in V3 schema
    }

    // Find or create laptop using V3 schema (brand stored directly on laptops)
    let laptopQuery = client.from('laptops').select('id').ilike('model', modelName);
    if (brandName) {
      laptopQuery = laptopQuery.ilike('brand', brandName);
    }
    const { data: existingLaptop } = await laptopQuery.maybeSingle();

    if (existingLaptop) {
      laptopId = existingLaptop.id;
    } else {
      const laptopInsertPayload: any = {
        brand: brandName,
        model: modelName,
        series,
        generation,
      };

      const { data: newLaptop, error: lapErr } = await client
        .from('laptops')
        .insert(laptopInsertPayload)
        .select('id')
        .single();

      if (lapErr || !newLaptop) {
        throw new Error(`Failed to create laptop record: ${lapErr?.message || 'Unknown database error'}`);
      }
      laptopId = newLaptop.id;
    }

    // Create configuration
    const configData = data.configuration;
    const { data: newConfig, error: configErr } = await client
      .from('configurations')
      .insert({
        laptop_id: laptopId,
        cpu: configData.cpu,
        gpu: configData.gpu,
        gpu_type: configData.gpu_type || 'unknown',
        gpu_tgp_w: configData.gpu_tgp_w,
        ram_gb: configData.ram_gb,
        ram_speed_mt_s: configData.ram_speed_mt_s,
        storage_gb: configData.storage_gb,
        storage_type: configData.storage_type,
        ssd_read_mb_s: configData.ssd_read_mb_s,
        ssd_write_mb_s: configData.ssd_write_mb_s,
        display_size_inch: configData.display_size_inch,
        display_resolution: configData.display_resolution,
        refresh_rate_hz: configData.refresh_rate_hz,
        panel_type: configData.panel_type,
        battery_wh: configData.battery_wh,
        weight_kg: configData.weight_kg,
        thickness_mm: configData.thickness_mm,
        webcam: configData.webcam,
        build_quality: configData.build_quality,
      })
      .select('id')
      .single();

    if (configErr || !newConfig) {
      throw new Error(`Failed to create hardware configuration: ${configErr?.message}`);
    }

    configurationId = newConfig.id;
  }

  // 4. Create review_source
  const { data: reviewSource, error: reviewErr } = await client
    .from('review_sources')
    .insert({
      configuration_id: configurationId,
      youtube_url: videoUrl,
      youtube_video_id: videoId,
      title: data.review_meta.title || 'YouTube Review',
      reviewer: data.review_meta.reviewer || 'Reviewer',
      published_date: data.review_meta.published_date || null,
      verdict_summary: data.review_meta.verdict_summary || null,
      verdict_pros: data.review_meta.verdict_pros || [],
      verdict_cons: data.review_meta.verdict_cons || [],
      raw_data: data,
    })
    .select('id')
    .single();

  if (reviewErr || !reviewSource) {
    throw new Error(`Failed to create review source record: ${reviewErr?.message}`);
  }

  const reviewSourceId = reviewSource.id;

  // 5. Insert benchmarks
  if (data.benchmarks && data.benchmarks.length > 0) {
    const bRows = data.benchmarks.map((b) => ({
      review_source_id: reviewSourceId,
      benchmark_name: b.benchmark_name || b.benchmark_group || 'Benchmark',
      benchmark_group: b.benchmark_group || b.benchmark_name || 'Benchmark',
      benchmark_version: b.benchmark_version || null,
      variant: b.variant || null,
      category: b.category || 'system',
      score: b.score,
      unit: b.unit || null,
      power_mode: b.power_mode || null,
      source_timestamp: b.source_timestamp || null,
      notes: b.notes || null,
    }));
    await client.from('benchmark_results').insert(bRows);
  }

  // 6. Insert gaming results
  if (data.gaming && data.gaming.length > 0) {
    const gRows = data.gaming.map((g) => ({
      review_source_id: reviewSourceId,
      game: g.game,
      resolution: g.resolution || null,
      preset: g.preset || null,
      ray_tracing: g.ray_tracing ?? null,
      upscaling: g.upscaling ?? null,
      upscaling_mode: g.upscaling_mode || null,
      frame_generation: g.frame_generation ?? null,
      avg_fps: g.avg_fps,
      one_percent_low_fps: g.one_percent_low_fps ?? null,
      source_timestamp: g.source_timestamp || null,
      notes: g.notes || null,
    }));
    await client.from('gaming_results').insert(gRows);
  }

  // 7. Insert thermal results
  if (data.thermals && data.thermals.length > 0) {
    const tRows = data.thermals.map((t) => ({
      review_source_id: reviewSourceId,
      test_name: t.test_name || 'Thermal Test',
      cpu_peak_c: t.cpu_peak_c ?? null,
      gpu_peak_c: t.gpu_peak_c ?? null,
      keyboard_max_c: t.keyboard_max_c ?? null,
      cpu_peak_power_w: t.cpu_peak_power_w ?? null,
      gpu_peak_power_w: t.gpu_peak_power_w ?? null,
      fan_noise_db: t.fan_noise_db ?? null,
      source_timestamp: t.source_timestamp || null,
      notes: t.notes || null,
    }));
    await client.from('thermal_results').insert(tRows);
  }

  // 8. Insert display results
  if (data.display && Object.values(data.display).some((v) => v !== null && v !== undefined)) {
    await client.from('display_results').insert({
      review_source_id: reviewSourceId,
      brightness_sdr_nits: data.display.brightness_sdr_nits ?? null,
      brightness_hdr_nits: data.display.brightness_hdr_nits ?? null,
      srgb_percent: data.display.srgb_percent ?? null,
      dci_p3_percent: data.display.dci_p3_percent ?? null,
      response_time_ms: data.display.response_time_ms ?? null,
      contrast_ratio: data.display.contrast_ratio ?? null,
      notes: data.display.notes ?? null,
    });
  }

  // 9. Insert battery results
  if (data.battery && Object.values(data.battery).some((v) => v !== null && v !== undefined)) {
    await client.from('battery_results').insert({
      review_source_id: reviewSourceId,
      battery_wh: data.battery.battery_wh ?? null,
      battery_life_hours: data.battery.battery_life_hours ?? null,
      test_method: data.battery.test_method ?? null,
      charging_adapter_w: data.battery.charging_adapter_w ?? null,
      usb_c_charging_w: data.battery.usb_c_charging_w ?? null,
      full_charge_min: data.battery.full_charge_min ?? null,
      notes: data.battery.notes ?? null,
    });
  }

  // 10. Update extraction_job state
  await client
    .from('extraction_jobs')
    .update({
      status: 'completed',
      review_source_id: reviewSourceId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  // 11. Handle optional retail listings non-blockingly
  if (params.retailListings && configurationId) {
    try {
      await handleRetailListingsCommit(configurationId, params.retailListings);
    } catch (retailErr) {
      console.warn('Non-blocking retail listings save error:', retailErr);
    }
  }

  return {
    status: 'success',
    review_source_id: reviewSourceId,
    configuration_id: configurationId,
    laptop_id: laptopId,
  };
}

async function handleRetailListingsCommit(
  configurationId: string,
  retailListings: {
    amazonUrl?: string | null;
    flipkartUrl?: string | null;
    manualImageUrl?: string | null;
    amazonManualPrice?: number | null;
    flipkartManualPrice?: number | null;
  }
) {
  const client = getSupabaseClient();

  const handleRetailer = async (
    retailer: RetailerType,
    url?: string | null,
    manualPrice?: number | null
  ) => {
    if (!url) return;

    const priceToSet = manualPrice ?? null;
    const imageUrlToSet = retailListings.manualImageUrl || null;

    // Check existing
    const { data: existing } = await client
      .from('product_listings')
      .select('id, current_price')
      .eq('configuration_id', configurationId)
      .eq('retailer', retailer)
      .maybeSingle();

    let listingId = existing?.id;

    if (existing) {
      await client
        .from('product_listings')
        .update({
          product_url: url,
          image_url: imageUrlToSet || undefined,
          current_price: priceToSet ?? existing.current_price,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      const { data: inserted } = await client
        .from('product_listings')
        .insert({
          configuration_id: configurationId,
          retailer,
          product_url: url,
          image_url: imageUrlToSet,
          current_price: priceToSet,
          currency: 'INR',
          in_stock: true,
          last_checked_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      listingId = inserted?.id;
    }

    // Append to price_history if price is provided and changed
    if (listingId && priceToSet != null && (!existing || existing.current_price !== priceToSet)) {
      await client.from('price_history').insert({
        listing_id: listingId,
        price: priceToSet,
        checked_at: new Date().toISOString(),
      });
    }
  };

  await Promise.allSettled([
    handleRetailer('amazon', retailListings.amazonUrl, retailListings.amazonManualPrice),
    handleRetailer('flipkart', retailListings.flipkartUrl, retailListings.flipkartManualPrice),
  ]);
}
