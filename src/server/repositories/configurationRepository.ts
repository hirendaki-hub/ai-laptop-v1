import { getSupabaseClient } from '../external/supabase.ts';
import type { ConfigurationMatchResult, MatchClassification } from '../../shared/types/index.ts';

export async function getConfigurationById(id: string) {
  const client = getSupabaseClient();

  // Query configuration
  const { data, error } = await client
    .from('configurations')
    .select(`
      *,
      laptops(
        id,
        brand,
        model,
        series,
        generation
      ),
      review_sources(
        id,
        youtube_url,
        youtube_video_id,
        title,
        reviewer,
        published_date,
        verdict_summary,
        verdict_pros,
        verdict_cons,
        created_at,
        benchmark_results(*),
        gaming_results(*),
        thermal_results(*),
        display_results(*),
        battery_results(*)
      ),
      product_listings(
        id,
        retailer,
        product_url,
        image_url,
        current_price,
        currency,
        in_stock,
        last_checked_at
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch configuration: ${error.message}`);
  }

  const laptop = (data as any).laptops;
  const brandName = (laptop as any)?.brand || (data as any).brand || 'Unknown';

  // Aggregate results across all review sources if needed for direct access
  const allReviews = (data as any).review_sources || [];
  const benchmark_results = allReviews.flatMap((r: any) => r.benchmark_results || []);
  const gaming_results = allReviews.flatMap((r: any) => r.gaming_results || []);
  const thermal_results = allReviews.flatMap((r: any) => r.thermal_results || []);
  const display_results = allReviews.flatMap((r: any) => r.display_results || []);
  const battery_results = allReviews.flatMap((r: any) => r.battery_results || []);

  return {
    ...data,
    laptop: {
      id: laptop?.id,
      model: laptop?.model || 'Unknown Model',
      series: laptop?.series || null,
      generation: laptop?.generation || null,
      brand_id: null,
      brand_name: brandName,
      brand: brandName,
    },
    review_sources: allReviews,
    benchmark_results,
    gaming_results,
    thermal_results,
    display_results,
    battery_results,
    review_count: allReviews.length,
  };
}

export async function getConfigurationsForCompare(ids: string[]) {
  if (!ids || ids.length === 0) return [];
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('configurations')
    .select(`
      *,
      laptops(
        id,
        brand,
        model,
        series,
        generation
      ),
      review_sources(
        id,
        youtube_url,
        youtube_video_id,
        title,
        reviewer,
        verdict_summary,
        verdict_pros,
        verdict_cons,
        benchmark_results(*),
        gaming_results(*),
        thermal_results(*),
        display_results(*),
        battery_results(*)
      ),
      product_listings(
        id,
        retailer,
        current_price,
        image_url,
        product_url,
        in_stock
      )
    `)
    .in('id', ids.slice(0, 3));

  if (error) throw new Error(`Failed to fetch configurations for compare: ${error.message}`);

  const configs = await Promise.all(
    (data || []).map(async (c: any) => {
      const laptop = c.laptops;
      const brandName = laptop?.brand || c.brand || 'Unknown';

      const allReviews = c.review_sources || [];
      const benchmark_results = allReviews.flatMap((r: any) => r.benchmark_results || []);
      const gaming_results = allReviews.flatMap((r: any) => r.gaming_results || []);
      const thermal_results = allReviews.flatMap((r: any) => r.thermal_results || []);
      const display_results = allReviews.flatMap((r: any) => r.display_results || []);
      const battery_results = allReviews.flatMap((r: any) => r.battery_results || []);

      return {
        ...c,
        laptop: {
          id: laptop?.id,
          model: laptop?.model || 'Unknown Model',
          series: laptop?.series || null,
          generation: laptop?.generation || null,
          brand_id: null,
          brand_name: brandName,
          brand: brandName,
        },
        review_sources: allReviews,
        benchmark_results,
        gaming_results,
        thermal_results,
        display_results,
        battery_results,
        review_count: allReviews.length,
      };
    })
  );

  return configs;
}

export async function findMatchingConfigurations(candidate: {
  brand: string;
  model: string;
  series: string | null;
  generation: string | null;
  cpu: string | null;
  gpu: string | null;
  gpu_tgp_w: number | null;
  ram_gb: number | null;
  ram_speed_mt_s: number | null;
  storage_gb: number | null;
  display_size_inch: number | null;
  display_resolution: string | null;
  refresh_rate_hz: number | null;
  battery_wh: number | null;
}): Promise<ConfigurationMatchResult[]> {
  const client = getSupabaseClient();

  // Find laptops matching candidate model
  const candModelClean = candidate.model.toLowerCase().replace(/[^a-z0-9]/g, '');

  const { data: laptopsData, error: laptopError } = await client
    .from('laptops')
    .select(`
      id,
      brand,
      model,
      series,
      generation,
      configurations(*)
    `);

  if (laptopError || !laptopsData || laptopsData.length === 0) {
    return [
      {
        classification: 'NO MATCH',
        confidenceScore: 0,
        matchedConfiguration: null,
        matchedLaptop: null,
        matchedBrand: null,
        matchingReasons: ['No laptops registered in database'],
        differingFields: ['model'],
      },
    ];
  }

  const results: ConfigurationMatchResult[] = [];

  for (const laptop of laptopsData) {
    const lapModelClean = (laptop.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const modelMatches =
      candModelClean.length > 0 &&
      (candModelClean === lapModelClean ||
        lapModelClean.includes(candModelClean) ||
        candModelClean.includes(lapModelClean));

    if (!modelMatches) continue;

    const configs = (laptop.configurations as any[]) || [];
    if (configs.length === 0) {
      results.push({
        classification: 'PARTIAL MATCH',
        confidenceScore: 40,
        matchedConfiguration: null,
        matchedLaptop: {
          id: laptop.id,
          brand: candidate.brand,
          model: laptop.model,
          series: laptop.series,
          generation: laptop.generation,
        },
        matchedBrand: null,
        matchingReasons: ['Laptop model matched, but has no existing configurations'],
        differingFields: ['configuration'],
      });
      continue;
    }

    for (const conf of configs) {
      const matchReasons: string[] = ['Model matched (' + laptop.model + ')'];
      const differing: string[] = [];
      let points = 30;
      let totalMaxPoints = 30;

      // Series match
      if (candidate.series || laptop.series) {
        totalMaxPoints += 10;
        if (candidate.series && laptop.series && candidate.series.toLowerCase() === laptop.series.toLowerCase()) {
          points += 10;
          matchReasons.push(`Series matched: ${laptop.series}`);
        } else if (candidate.series && laptop.series) {
          differing.push(`Series: candidate=${candidate.series} vs existing=${laptop.series}`);
        }
      }

      // CPU match
      if (candidate.cpu || conf.cpu) {
        totalMaxPoints += 20;
        if (candidate.cpu && conf.cpu && normalizeHardwareString(candidate.cpu) === normalizeHardwareString(conf.cpu)) {
          points += 20;
          matchReasons.push(`CPU matched: ${conf.cpu}`);
        } else {
          differing.push(`CPU: candidate=${candidate.cpu || 'N/A'} vs existing=${conf.cpu || 'N/A'}`);
        }
      }

      // GPU match
      if (candidate.gpu || conf.gpu) {
        totalMaxPoints += 20;
        if (candidate.gpu && conf.gpu && normalizeHardwareString(candidate.gpu) === normalizeHardwareString(conf.gpu)) {
          points += 20;
          matchReasons.push(`GPU matched: ${conf.gpu}`);
        } else {
          differing.push(`GPU: candidate=${candidate.gpu || 'N/A'} vs existing=${conf.gpu || 'N/A'}`);
        }
      }

      // RAM match
      if (candidate.ram_gb || conf.ram_gb) {
        totalMaxPoints += 10;
        if (candidate.ram_gb && conf.ram_gb && candidate.ram_gb === conf.ram_gb) {
          points += 10;
          matchReasons.push(`RAM matched: ${conf.ram_gb} GB`);
        } else {
          differing.push(`RAM: candidate=${candidate.ram_gb || 'N/A'} vs existing=${conf.ram_gb || 'N/A'}`);
        }
      }

      const confidenceScore = Math.round((points / totalMaxPoints) * 100);
      let classification: MatchClassification = 'NO MATCH';

      if (confidenceScore >= 90 && differing.length === 0) {
        classification = 'EXACT MATCH';
      } else if (confidenceScore >= 70 && differing.length <= 1) {
        classification = 'LIKELY MATCH';
      } else if (confidenceScore >= 40) {
        classification = 'PARTIAL MATCH';
      }

      results.push({
        classification,
        confidenceScore,
        matchedConfiguration: conf,
        matchedLaptop: {
          id: laptop.id,
          brand: candidate.brand,
          model: laptop.model,
          series: laptop.series,
          generation: laptop.generation,
        },
        matchedBrand: null,
        matchingReasons: matchReasons,
        differingFields: differing,
      });
    }
  }

  if (results.length === 0) {
    return [
      {
        classification: 'NO MATCH',
        confidenceScore: 0,
        matchedConfiguration: null,
        matchedLaptop: null,
        matchedBrand: null,
        matchingReasons: ['No existing configuration matched model identity'],
        differingFields: ['model'],
      },
    ];
  }

  return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function normalizeHardwareString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}
