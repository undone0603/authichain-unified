import { z } from 'zod';
const isTest = process.env.NODE_ENV === 'test' || typeof globalThis.it !== 'undefined';
const envSchema = z.object({
    DATABASE_URL: isTest ? z.string().url().optional() : z.string().url(),
    STRIPE_SECRET_KEY: process.env.NODE_ENV === 'production' ? z.string().min(1) : z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    HUBSPOT_SERVICE_KEY: process.env.NODE_ENV === 'production' ? z.string().min(1) : z.string().optional(),
    THIRDWEB_SECRET_KEY: process.env.NODE_ENV === 'production' ? z.string().min(1) : z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    HEYGEN_API_KEY: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    process.exit(1);
}
export const env = _env.data;
