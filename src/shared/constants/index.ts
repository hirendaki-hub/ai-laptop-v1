export const APP_CONFIG = {
  name: 'AI Laptop Review',
  version: '3.0.0',
  defaultGeminiModel: 'gemini-3.8-flash',
  maxCompareLaptops: 3,
  jobTimeoutMs: 90000,
  maxExtractionAttempts: 2, // 1 normal + max 1 retry
  maxBenchmarksCount: 8,
  maxGamesCount: 5,
  maxProsCons: 5,
};

export const PRIORITY_GAMES = [
  'GTA V Enhanced',
  'Black Myth: Wukong',
  'Cyberpunk 2077',
  'Red Dead Redemption 2',
  'Hogwarts Legacy',
] as const;

export const TARGET_BENCHMARK_FAMILIES = [
  'Cinebench R23',
  'Cinebench 2024',
  'Geekbench 6',
  '3DMark Time Spy',
  'PCMark 10',
  'CrystalDiskMark',
] as const;

export const ERROR_CODES = {
  // Client & Validation
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_YOUTUBE_URL: 'INVALID_YOUTUBE_URL',
  DUPLICATE_VIDEO: 'DUPLICATE_VIDEO',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Gemini & Ingestion
  GEMINI_NOT_CONFIGURED: 'GEMINI_NOT_CONFIGURED',
  GEMINI_AUTH_FAILED: 'GEMINI_AUTH_FAILED',
  GEMINI_TIMEOUT: 'GEMINI_TIMEOUT',
  GEMINI_RATE_LIMIT: 'GEMINI_RATE_LIMIT',
  GEMINI_EXTRACTION_FAILED: 'GEMINI_EXTRACTION_FAILED',
  GEMINI_SCHEMA_ERROR: 'GEMINI_SCHEMA_ERROR',

  // Database & Persistence
  DATABASE_NOT_CONFIGURED: 'DATABASE_NOT_CONFIGURED',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',

  // Retail Scraper
  RETAIL_FETCH_FAILED: 'RETAIL_FETCH_FAILED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export const BENCHMARK_CATEGORIES = [
  'cpu',
  'gpu',
  'storage',
  'system',
] as const;
