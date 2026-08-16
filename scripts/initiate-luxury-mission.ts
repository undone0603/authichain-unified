import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server/_core/index'; // Adjust path if necessary
import superjson from 'superjson';

const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
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
