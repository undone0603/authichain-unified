# QRON.space Authentication Overview

QRON.space utilizes **Supabase Auth** for user authentication, providing a secure and flexible system that supports various social providers.

## Implementation Details

- **Supabase Client:** The application uses `@/utils/supabase/client` for client-side authentication interactions and `@/utils/supabase/server` for server-side (API route) authentication.
- **User Sessions:** User sessions are managed by Supabase. When a user logs in, a session is established, and user information (like `user.id`) is accessible across the application.
- **API Route Protection:** Core API routes, such as `/api/generate`, check for an authenticated user session (`supabase.auth.getUser()`) and return a `401 Unauthorized` response if no user is found.
- **User Profiles:** After authentication, user-specific data (like `tier`, `generations_used`, `generations_limit`) is fetched from a `profiles` table in Supabase. This links user authentication directly to the monetization and feature access system.

## Setup Instructions

To enable and configure Supabase authentication for your QRON.space instance, you need to set the following environment variables in your `.env.local` file:

1.  **`NEXT_PUBLIC_SUPABASE_URL`**: Your Supabase project URL.
2.  **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Your Supabase project's `anon` public key.
3.  **`SUPABASE_SERVICE_ROLE_KEY`**: Your Supabase project's `service_role` key (used for server-side operations, keep this secret).

**Example `.env.local` snippet:**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
```

**Steps to get your Supabase keys:**

1.  Go to your Supabase project dashboard.
2.  Navigate to "Project Settings" -> "API".
3.  You will find your Project URL and `anon` public key there.
4.  The `service_role` key is also under the "API" settings, but be cautious with its use as it grants full database access.

## Testing Authentication

1.  **Ensure Supabase is configured:** Make sure your `.env.local` has the correct Supabase keys.
2.  **Run the application locally:** `npm run dev`
3.  **Access the application:** Open `http://localhost:3000` in your browser.
4.  **Login/Register:** The application's UI (not explicitly shown in current `app/page.tsx` but part of `qron-starter-v2` via `Auth` component or similar) will likely prompt you to log in or register. You can use email/password or any social providers you've enabled in your Supabase project.
5.  **Verify Profile:** After logging in, try generating a QRON. The system should correctly identify your user `tier` and apply `generation limits`.

This concludes the overview of authentication in QRON.space. Let me know if you have further questions or need assistance with specific parts.
