import { getSupabaseClient } from '../external/supabase.ts';

export async function getAllBrands(): Promise<Array<{ id: string; name: string }>> {
  const client = getSupabaseClient();
  // V3 schema: laptops table stores brand text directly
  try {
    const { data: laptops, error } = await client
      .from('laptops')
      .select('brand')
      .not('brand', 'is', null);

    if (!error && laptops && laptops.length > 0) {
      const distinct = Array.from(
        new Set(laptops.map((l: any) => l.brand?.trim()).filter(Boolean))
      ).sort();
      return distinct.map((name) => ({ id: name, name }));
    }
  } catch {}

  // Fallback: standalone laptop_brands table if it exists
  try {
    const { data, error } = await client
      .from('laptop_brands')
      .select('id, name')
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch {}

  return [];
}

export async function getAllLaptops(options: {
  search?: string;
  brand?: string;
  page?: number;
  limit?: number;
}) {
  const client = getSupabaseClient();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  let query = client
    .from('laptops')
    .select(
      `
      *,
      configurations(
        id,
        cpu,
        gpu,
        gpu_type,
        gpu_tgp_w,
        ram_gb,
        storage_gb,
        display_size_inch,
        display_resolution,
        refresh_rate_hz,
        webcam,
        build_quality,
        review_sources(id)
      )
    `,
      { count: 'exact' }
    );

  if (options.brand && options.brand.trim()) {
    query = query.ilike('brand', options.brand.trim());
  }

  if (options.search) {
    const s = options.search.trim();
    query = query.or(`model.ilike.%${s}%,series.ilike.%${s}%,generation.ilike.%${s}%,brand.ilike.%${s}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.warn('Query with configurations failed, trying simple query:', error.message);
    let simpleQuery = client.from('laptops').select('*', { count: 'exact' });
    if (options.brand && options.brand.trim()) {
      simpleQuery = simpleQuery.ilike('brand', options.brand.trim());
    }
    if (options.search) {
      const s = options.search.trim();
      simpleQuery = simpleQuery.or(`model.ilike.%${s}%,series.ilike.%${s}%,generation.ilike.%${s}%,brand.ilike.%${s}%`);
    }
    const simple = await simpleQuery.range(offset, offset + limit - 1);
    if (simple.error) throw new Error(`Failed to fetch laptops: ${simple.error.message}`);
    return {
      laptops: (simple.data || []).map((l: any) => ({
        id: l.id,
        brand: l.brand || 'Unknown',
        brand_name: l.brand || 'Unknown',
        brand_id: null,
        model: l.model,
        series: l.series,
        generation: l.generation,
        configuration_count: 0,
        review_count: 0,
        configurations: [],
      })),
      total: simple.count || 0,
      page,
      limit,
      totalPages: Math.ceil((simple.count || 0) / limit),
    };
  }

  const formatted = (data || []).map((l: any) => {
    const configs = l.configurations || [];
    const reviewCount = configs.reduce((acc: number, c: any) => acc + (c.review_sources?.length || 0), 0);
    const brandName = l.brand || 'Unknown';

    return {
      id: l.id,
      brand: brandName,
      brand_id: null,
      brand_name: brandName,
      model: l.model,
      series: l.series,
      generation: l.generation,
      created_at: l.created_at,
      configuration_count: configs.length,
      review_count: reviewCount,
      configurations: configs.map((c: any) => ({
        id: c.id,
        cpu: c.cpu,
        gpu: c.gpu,
        gpu_type: c.gpu_type,
        gpu_tgp_w: c.gpu_tgp_w,
        ram_gb: c.ram_gb,
        storage_gb: c.storage_gb,
        display_size_inch: c.display_size_inch,
        display_resolution: c.display_resolution,
        refresh_rate_hz: c.refresh_rate_hz,
        webcam: c.webcam,
        build_quality: c.build_quality,
        review_count: c.review_sources?.length || 0,
      })),
    };
  });

  return {
    laptops: formatted,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getLaptopById(id: string) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('laptops')
    .select(`
      *,
      configurations(
        id,
        cpu,
        gpu,
        gpu_type,
        gpu_tgp_w,
        ram_gb,
        ram_speed_mt_s,
        storage_gb,
        storage_type,
        ssd_read_mb_s,
        ssd_write_mb_s,
        display_size_inch,
        display_resolution,
        refresh_rate_hz,
        panel_type,
        battery_wh,
        weight_kg,
        thickness_mm,
        webcam,
        build_quality,
        created_at,
        review_sources(
          id,
          youtube_url,
          youtube_video_id,
          title,
          reviewer,
          published_date,
          verdict_summary,
          verdict_pros,
          verdict_cons
        ),
        product_listings(
          id,
          retailer,
          product_url,
          image_url,
          current_price,
          currency,
          in_stock
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch laptop: ${error.message}`);
  }

  const brandName = (data as any)?.brand || 'Unknown';

  return {
    ...(data as Record<string, any>),
    brand: brandName,
    brand_name: brandName,
  };
}

export async function deleteLaptop(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { error } = await client.from('laptops').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete laptop: ${error.message}`);
  return true;
}
