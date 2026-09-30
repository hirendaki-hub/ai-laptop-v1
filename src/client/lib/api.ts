import type {
  SystemStatusResponse,
  ExtractionJob,
  ConfigurationMatchResult,
  Configuration,
  GeminiModelInfo,
} from '../../shared/types/index.ts';

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || response.statusText || 'API request failed';
    const code = data?.error?.code || 'API_ERROR';
    const err: any = new Error(errorMsg);
    err.code = code;
    err.status = response.status;
    err.details = data?.error?.details;
    throw err;
  }

  return data as T;
}

export const api = {
  // Status & Health
  getStatus: () => fetchApi<SystemStatusResponse>('/api/status'),
  getHealth: () => fetchApi<{ status: string }>('/api/health'),

  // Gemini Models
  getModels: () => fetchApi<{ activeModel: string; models: GeminiModelInfo[] }>('/api/gemini/models'),
  testModel: (modelId: string) =>
    fetchApi<{
      modelId: string;
      status: string;
      latencyMs?: number;
      testedAt: string;
      error?: string;
    }>(`/api/gemini/models/${encodeURIComponent(modelId)}/test`, { method: 'POST' }),
  setActiveModel: (model: string) =>
    fetchApi<{ success: boolean; currentModel: string; message: string }>('/api/gemini/model', {
      method: 'POST',
      body: JSON.stringify({ model }),
    }),

  // Extraction
  extractVideo: (youtubeUrl: string, model?: string) =>
    fetchApi<{ jobId: string; status: string; videoId: string; message: string }>('/api/extract', {
      method: 'POST',
      body: JSON.stringify({ youtube_url: youtubeUrl, model }),
    }),

  getJob: (jobId: string) => fetchApi<ExtractionJob>(`/api/extract/${jobId}`),

  getJobMatches: (jobId: string) =>
    fetchApi<{ jobId: string; matches: ConfigurationMatchResult[] }>(`/api/extract/${jobId}/matches`),

  commitJob: (jobId: string, payload: any) =>
    fetchApi<{ status: string; review_source_id: string; configuration_id: string }>(
      `/api/extract/${jobId}/commit`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  discardJob: (jobId: string) =>
    fetchApi<{ status: string }>(`/api/extract/${jobId}/discard`, {
      method: 'POST',
    }),

  // Jobs
  getJobs: () => fetchApi<{ jobs: ExtractionJob[] }>('/api/jobs'),
  retryJob: (jobId: string) =>
    fetchApi<{ status: string }>(`/api/jobs/${jobId}/retry`, { method: 'POST' }),
  deleteJob: (jobId: string) =>
    fetchApi<{ status: string }>(`/api/jobs/${jobId}`, { method: 'DELETE' }),

  // Laptops & Brands
  getBrands: () => fetchApi<{ brands: Array<{ id: string; name: string }> }>('/api/brands'),
  getLaptops: (params: { search?: string; brand?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.brand) q.set('brand', params.brand);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return fetchApi<{
      laptops: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/laptops?${q.toString()}`);
  },
  getLaptop: (id: string) => fetchApi<any>(`/api/laptops/${id}`),
  deleteLaptop: (id: string) => fetchApi<{ status: string }>(`/api/laptops/${id}`, { method: 'DELETE' }),

  // Configurations & Compare
  getConfiguration: (id: string) => fetchApi<Configuration>(`/api/configurations/${id}`),
  getCompare: (ids: string[]) =>
    fetchApi<{ configurations: any[] }>(`/api/compare?ids=${ids.join(',')}`),

  // Retail Preview
  previewRetailUrl: (url: string) =>
    fetchApi<{ result: any }>('/api/listings/preview', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
};
