import { Router, Request, Response, NextFunction } from 'express';
import { parseAndValidateYouTubeUrl } from '../services/urlValidator.ts';
import {
  createExtractionJob,
  getJobById,
  findJobByVideoId,
  findReviewSourceByVideoId,
  updateJob,
  listJobs,
  deleteJob,
  clearAllJobs,
} from '../repositories/jobsRepository.ts';
import { executeExtractionJob } from '../jobs/jobWorker.ts';
import { commitReviewedExtraction } from '../repositories/commitRepository.ts';
import {
  getAllLaptops,
  getLaptopById,
  deleteLaptop,
  getAllBrands,
} from '../repositories/laptopRepository.ts';
import {
  getConfigurationById,
  getConfigurationsForCompare,
  findMatchingConfigurations,
} from '../repositories/configurationRepository.ts';
import { testSupabaseConnection } from '../external/supabase.ts';
import { testGeminiConnection } from '../external/gemini.ts';
import {
  listExtractionModels,
  testModelHealth,
  setActiveGeminiModel,
  getActiveGeminiModel,
} from '../services/geminiModelService.ts';
import { extractListingData, Retailer } from '../listings.ts';
import { requireAdmin } from '../middleware/security.ts';
import { CommitPayloadSchema } from '../../shared/schemas/extraction.ts';
import { APP_CONFIG, ERROR_CODES } from '../../shared/constants/index.ts';
import type { SystemStatusResponse, ExtractedDataPayload } from '../../shared/types/index.ts';

const router = Router();

// ==========================================
// 1. HEALTH & SYSTEM STATUS
// ==========================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    name: APP_CONFIG.name,
    version: APP_CONFIG.version,
    timestamp: new Date().toISOString(),
  });
});

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [supabaseStatus, geminiStatus] = await Promise.all([
      testSupabaseConnection(),
      testGeminiConnection(),
    ]);

    const overallAppStatus =
      supabaseStatus.status === 'LIVE' && geminiStatus.status === 'LIVE'
        ? 'LIVE'
        : supabaseStatus.status === 'ERROR' || geminiStatus.status === 'ERROR'
        ? 'ERROR'
        : 'WARNING';

    const statusResponse: SystemStatusResponse = {
      application: {
        name: APP_CONFIG.name,
        version: APP_CONFIG.version,
        environment: process.env.NODE_ENV || 'development',
        status: overallAppStatus,
      },
      gemini: {
        status: geminiStatus.status,
        model: geminiStatus.model,
        latencyMs: geminiStatus.latencyMs,
        error: geminiStatus.error,
      },
      supabase: {
        status: supabaseStatus.status,
        reachable: supabaseStatus.status === 'LIVE',
        connectionStatus: supabaseStatus.status,
        latencyMs: supabaseStatus.latencyMs,
        error: supabaseStatus.error,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(statusResponse);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. GEMINI MODEL DISCOVERY & MANAGEMENT
// ==========================================

router.get('/gemini/models', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listExtractionModels();
    res.json({
      activeModel: data.currentModel,
      currentModel: data.currentModel,
      models: data.models,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'GEMINI_MODELS_ERROR',
        message: err.message,
      },
    });
  }
});

router.post('/gemini/models/:modelId/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const modelId = req.params.modelId;
    const testResult = await testModelHealth(modelId);
    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'MODEL_TEST_FAILED',
        message: err.message,
      },
    });
  }
});

router.post('/gemini/model', (req: Request, res: Response) => {
  const { model } = req.body;
  if (!model || typeof model !== 'string') {
    res.status(400).json({
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'A valid string model name is required in body.',
      },
    });
    return;
  }

  const cleanModel = model.replace(/^models\//, '').trim();
  if (cleanModel.startsWith('AIza') || cleanModel.startsWith('AQ.') || cleanModel.length > 50 || cleanModel.includes('"') || cleanModel.includes("'")) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: 'Invalid model ID provided. API keys cannot be set as model identifiers.',
      },
    });
    return;
  }

  try {
    const active = setActiveGeminiModel(cleanModel);
    res.json({
      success: true,
      currentModel: active,
      activeModel: active,
      message: `Active extraction model set to ${active}`,
    });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: err.message,
      },
    });
  }
});

// ==========================================
// 3. EXTRACTION WORKFLOW
// ==========================================

router.post('/extract', async (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId || 'req_unknown';
  try {
    const { youtube_url, model } = req.body;
    if (!youtube_url) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'youtube_url is required',
          requestId: reqId,
        },
      });
      return;
    }

    const urlCheck = parseAndValidateYouTubeUrl(youtube_url);
    if (!urlCheck.isValid || !urlCheck.videoId || !urlCheck.canonicalUrl) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.INVALID_YOUTUBE_URL,
          message: urlCheck.error || 'Invalid YouTube URL provided',
          requestId: reqId,
        },
      });
      return;
    }

    const videoId = urlCheck.videoId;
    const canonicalUrl = urlCheck.canonicalUrl;

    const existingReview = await findReviewSourceByVideoId(videoId);
    if (existingReview) {
      res.status(409).json({
        error: {
          code: ERROR_CODES.DUPLICATE_VIDEO,
          message: `This YouTube review has already been extracted and published: "${existingReview.title}" by ${existingReview.reviewer}.`,
          requestId: reqId,
          details: {
            review_source_id: existingReview.id,
            configuration_id: existingReview.configuration_id,
            existingReview,
          },
        },
      });
      return;
    }

    const existingJob = await findJobByVideoId(videoId);
    if (existingJob && (existingJob.status === 'processing' || existingJob.status === 'ready_for_review')) {
      res.json({
        jobId: existingJob.id,
        status: existingJob.status,
        videoId,
        isExistingJob: true,
      });
      return;
    }

    const job = await createExtractionJob({
      youtube_url: canonicalUrl,
      youtube_video_id: videoId,
    });

    const selectedModel = typeof model === 'string' && model.trim() ? model.trim() : getActiveGeminiModel();
    if (selectedModel) {
      await updateJob(job.id, { model_used: selectedModel }).catch((err) => {
        console.warn('Could not record selected model on job:', err.message);
      });
    }

    executeExtractionJob(job.id).catch((err) => {
      console.error(`Background worker error on job ${job.id}:`, err);
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      videoId,
      message: 'Extraction job created and queued for processing.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/extract/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId;
  try {
    const job = await getJobById(req.params.jobId);
    if (!job) {
      res.status(404).json({
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: `Job ${req.params.jobId} not found`,
          requestId: reqId,
        },
      });
      return;
    }

    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.get('/extract/:jobId/matches', async (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId;
  try {
    const job = await getJobById(req.params.jobId);
    if (!job || !job.raw_extraction) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'Job extraction data is not yet available for matching.',
          requestId: reqId,
        },
      });
      return;
    }

    const payload = job.raw_extraction;
    const matches = await findMatchingConfigurations({
      brand: payload.laptop.brand,
      model: payload.laptop.model,
      series: payload.laptop.series || null,
      generation: payload.laptop.generation || null,
      cpu: payload.configuration.cpu || null,
      gpu: payload.configuration.gpu || null,
      gpu_tgp_w: payload.configuration.gpu_tgp_w || null,
      ram_gb: payload.configuration.ram_gb || null,
      ram_speed_mt_s: payload.configuration.ram_speed_mt_s || null,
      storage_gb: payload.configuration.storage_gb || null,
      display_size_inch: payload.configuration.display_size_inch || null,
      display_resolution: payload.configuration.display_resolution || null,
      refresh_rate_hz: payload.configuration.refresh_rate_hz || null,
      battery_wh: payload.configuration.battery_wh || null,
    });

    res.json({
      jobId: job.id,
      matches,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/extract/:jobId/commit', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId || 'req_unknown';
  try {
    const validation = CommitPayloadSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'Invalid commit payload structure',
          requestId: reqId,
          details: validation.error.issues,
        },
      });
      return;
    }

    const reviewerIdentity = validation.data.reviewerIdentity || 'admin';

    const result = await commitReviewedExtraction({
      jobId: req.params.jobId,
      data: validation.data.data as ExtractedDataPayload,
      useExistingConfigId: validation.data.useExistingConfigId,
      reviewerIdentity,
      retailListings: validation.data.retailListings,
    });

    res.json({
      status: 'committed',
      review_source_id: result.review_source_id,
      configuration_id: result.configuration_id,
      laptop_id: result.laptop_id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/extract/:jobId/discard', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await updateJob(req.params.jobId, { status: 'rejected' });
    res.json({ status: 'rejected', jobId: req.params.jobId });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. JOBS AUDIT & MANAGEMENT
// ==========================================

router.get('/jobs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await listJobs(50);
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/:id/retry', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: { code: ERROR_CODES.NOT_FOUND, message: 'Job not found' } });
      return;
    }

    await updateJob(job.id, { status: 'pending', attempt_count: 0, error_message: null });
    executeExtractionJob(job.id).catch((e) => console.error('Retry execution error:', e));

    res.json({ status: 'retry_initiated', jobId: job.id });
  } catch (err) {
    next(err);
  }
});

router.delete('/jobs/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteJob(req.params.id);
    res.json({ success: true, status: 'deleted', id: req.params.id });
  } catch (err) {
    next(err);
  }
});

router.delete('/jobs', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await clearAllJobs();
    res.json({ success: true, status: 'cleared' });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. LAPTOPS & BRANDS (PUBLIC)
// ==========================================

router.get('/brands', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const brands = await getAllBrands();
    res.json({ brands });
  } catch (err) {
    next(err);
  }
});

router.get('/laptops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, brand, page, limit } = req.query;
    const result = await getAllLaptops({
      search: typeof search === 'string' ? search : undefined,
      brand: typeof brand === 'string' ? brand : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/laptops/:id', async (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId;
  try {
    const laptop = await getLaptopById(req.params.id);
    if (!laptop) {
      res.status(404).json({
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Laptop not found', requestId: reqId },
      });
      return;
    }
    res.json(laptop);
  } catch (err) {
    next(err);
  }
});

router.delete('/laptops/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteLaptop(req.params.id);
    res.json({ status: 'deleted', id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. CONFIGURATIONS & COMPARE (PUBLIC)
// ==========================================

router.get('/configurations/:id', async (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId;
  try {
    const config = await getConfigurationById(req.params.id);
    if (!config) {
      res.status(404).json({
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Configuration not found', requestId: reqId },
      });
      return;
    }
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId;
  try {
    const { ids } = req.query;
    if (!ids || typeof ids !== 'string') {
      res.status(400).json({
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'ids query parameter is required (comma-separated, max 3)',
          requestId: reqId,
        },
      });
      return;
    }

    const idList = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    const configs = await getConfigurationsForCompare(idList);
    res.json({ configurations: configs });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 7. RETAIL LISTINGS
// ==========================================

router.post('/listings/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: { code: ERROR_CODES.INVALID_INPUT, message: 'URL is required' } });
      return;
    }

    const retailer: Retailer = url.toLowerCase().includes('flipkart') ? 'flipkart' : 'amazon';
    const scraped = await extractListingData(url.trim(), retailer);
    res.json({ result: scraped });
  } catch (err) {
    next(err);
  }
});

export default router;
