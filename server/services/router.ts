import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { SERVICE_LIST, SERVICE_CATALOG, SERVICE_KEYS, type ServiceType } from "../service-catalog";
import { ORDER_STATUSES, type OrderStatus } from "../../shared/const";
import { getDb } from "../db";
import {
  getServiceOrdersByUser,
  getAllServiceOrders,
  updateServiceOrderStatus,
  createServiceOrder,
} from "../db-helpers";
import { createPaymentCheckout } from "../stripe-service";

const serviceKeyEnum = z.enum(SERVICE_KEYS as [ServiceType, ...ServiceType[]]);
const orderStatusEnum = z.enum(ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]]);

export const servicesRouter = router({
  catalog: publicProcedure.query(() => {
    return SERVICE_LIST;
  }),

  myOrders: protectedProcedure.query(async ({ ctx }) => {
    // ctx.db does not exist on the live TrpcContext (server/_core/context.ts) —
    // only the separate Workers context has it. Documented bridge until this
    // router is wired up to a real per-request db.
    const db = await getDb();
    return await getServiceOrdersByUser(db, ctx.user.id);
  }),

  allOrders: adminProcedure.query(async () => {
    // Documented bridge — see myOrders above.
    const db = await getDb();
    return await getAllServiceOrders(db);
  }),

  updateStatus: adminProcedure.input(z.object({
    id: z.number(),
    status: orderStatusEnum,
  })).mutation(async ({ input }) => {
    // Documented bridge — see myOrders above.
    const db = await getDb();
    await updateServiceOrderStatus(db, input.id, input.status);
    return { success: true };
  }),

  checkout: protectedProcedure.input(z.object({
    serviceKey: serviceKeyEnum.optional(),
    serviceType: serviceKeyEnum.optional(),
    origin: z.string().optional(),
    businessName: z.string().optional(),
    businessType: z.string().optional(),
    businessUrl: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const key = input.serviceKey ?? input.serviceType;
    if (!key) throw new Error("serviceKey or serviceType is required");
    const service = SERVICE_CATALOG[key];

    const { url, sessionId } = await createPaymentCheckout({
      userId: ctx.user.id,
      userEmail: ctx.user.email || "",
      userName: ctx.user.name || "",
      description: service.name,
      amount: service.price,
      origin: input.origin ?? "https://authichain.com",
      metadata: {
        service_key: service.key,
        type: "one_time_service",
        business_name: input.businessName || "",
        business_type: input.businessType || "",
        business_url: input.businessUrl || "",
        notes: input.notes || "",
      },
    });

    // Documented bridge — see myOrders above.
    const db = await getDb();
    await createServiceOrder(db, {
      userId: ctx.user.id,
      serviceType: service.key,
      status: "pending",
      amount: service.price,
      stripeSessionId: sessionId,
      customerName: ctx.user.name || null,
    });

    return { checkoutUrl: url };
  }),
});
