import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  nodeEnv: process.env.NODE_ENV,
};

export function validateConfig() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
    'GEMINI_API_KEY',
  ];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`MISSING_CONFIG: Required environment variables: ${missing.join(', ')}`);
  }
}
