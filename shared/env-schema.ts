import { z } from "zod";

export const EnvSchema = z.object({
  // Add common secrets and environment variables here
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  WORKER_API_KEY: z.string().optional(),
  CRM_API_KEY: z.string().optional(),
  // Add other shared variables
});

export type Env = z.infer<typeof EnvSchema>;
