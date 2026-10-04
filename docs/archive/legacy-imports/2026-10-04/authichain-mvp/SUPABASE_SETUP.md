# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key

## 2. Set Up Database

1. In your Supabase dashboard, go to the SQL Editor
2. Run the SQL script from `supabase/schema.sql`
3. Run the migration from `supabase/migrations/add_ai_autoflow_fields.sql`
4. This will create:
   - `products` table
   - `scans` table
   - Indexes for performance
   - Row Level Security (RLS) policies
   - Storage bucket for product images
   - Storage policies

## 3. Configure Storage

The SQL script automatically creates a `product-images` bucket. Verify in Storage section:

- Bucket name: `product-images`
- Public: Yes
- File size limit: 10MB (recommended)
- Allowed MIME types: image/jpeg, image/png, image/webp

## 4. Enable Authentication

1. Go to Authentication > Providers
2. Enable Email provider
3. Configure email templates (optional)
4. Set up redirect URLs in Authentication > URL Configuration:

   **For Development:**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

   **For Production:**
   - Site URL: `https://your-domain.vercel.app` (or your production URL)
   - Redirect URLs: `https://your-domain.vercel.app/auth/callback`

   **Note:** You can add multiple redirect URLs separated by commas, e.g.:

   ```
   http://localhost:3000/auth/callback, https://your-domain.vercel.app/auth/callback
   ```

## 5. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Site Configuration (IMPORTANT for email redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Use your production URL in production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-postgres-connection-string

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Verification backend
# Example: https://qron.space/api/verify
VERIFY_API_URL=
```

**For Production (Vercel):**
Set these environment variables in your Vercel project settings:

- `NEXT_PUBLIC_SITE_URL` → `https://your-domain.vercel.app`
- All other variables as above

**Important:** `NEXT_PUBLIC_SITE_URL` is used for email confirmation redirects. If not set correctly, email links will redirect to localhost instead of your production site.

## 6. Test the Setup

Run the development server:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and test:

- User registration/login
- Product upload
- Image storage
- Database queries

Then verify schema sync:

```bash
npm run check:db
```

## Security Notes

- RLS policies are enabled for all tables
- Users can only access their own products
- Public verification is allowed via truemark_id
- Storage is restricted to authenticated users
- Service role key should never be exposed to the client
