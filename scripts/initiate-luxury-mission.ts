import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/routers';
import superjson from 'superjson';

// tRPC v11 moved `transformer` from the client root into the link config.
const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      transformer: superjson,
    }),
  ],
});

async function initiateLuxuryMission() {
  try {
    console.log("Initiating LUXURY_OUTREACH mission...");
    const mission = await client.missions.create.mutate({ type: 'LUXURY_OUTREACH' });
    console.log("Mission initiated successfully:", mission);
  } catch (error) {
    console.error("Failed to initiate mission:", error);
  }
}

initiateLuxuryMission();
