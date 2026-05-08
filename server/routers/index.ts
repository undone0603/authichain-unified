import { router } from '../_core/trpc';
import { metrcRouter } from './metrc';
import { productsRouter } from './products';
import { schedulerRouter } from './scheduler';
import { servicesRouter } from './services';

/**
 * Root tRPC router — merges all sub-routers.
 * Imported by server/_core/app.ts as appRouter.
 */
export const appRouter = router({
  metrc: metrcRouter,
  products: productsRouter,
  scheduler: schedulerRouter,
  services: servicesRouter,
});

export type AppRouter = typeof appRouter;
