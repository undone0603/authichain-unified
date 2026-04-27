import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { SERVICE_LIST, SERVICE_CATALOG, SERVICE_KEYS, type ServiceType } from "../service-catalog";
import { ORDER_STATUSES, type OrderStatus } from "../../shared/const";
import * as db from "../db";
import { createPaymentCheckout } from "../stripe-service";

const serviceKeyEnum = z.enum(SERVICE_KEYS as [ServiceType, ...ServiceType[]]);
const orderStatusEnum = z.enum(ORDER_STATUSES as unknown as [OrderStatus, ...OrderStatus[]]);

export const servicesRouter = router({
  catalog: publicProcedure.query(() => {
    return SERVICE_LIST;
  }),
  myOrders: protectedProcedure.query(async ({ ctx }) => {
    return await db.getServiceOrdersByUser(ctx.user.id);
  }),
  allOrders: adminProcedure.query(async () => {
    return await db.getAllServiceOrders();
  }),
  updateStatus: adminProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "paid", "in_progress", "delivered", "cancelled"]),
  })).mutation(async ({ input }) => {
    await db.updateServiceOrderStatus(input.id, input.status);
    return { success: true };
  }),
  checkout: protectedProcedure.input(z.object({
    serviceKey: serviceKeyEnum.optional(),
    serviceType: serviceKeyEnum.optional(), // Support both for frontend compatibility
    origin: z.string(),
    businessName: z.string().optional(),
    businessType: z.string().optional(),
    businessUrl: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const key = input.serviceKey ?? input.serviceType;
    if (!key) throw new Error("serviceKey or serviceType is required");
    const service = SERVICE_CATALOG[key];

    const url = await createPaymentCheckout({
      userId: ctx.user.id,
      userEmail: ctx.user.email || "",
      userName: ctx.user.name || "",
      description: service.name,
      amount: service.price,
      origin: input.origin,
      metadata: {
        service_key: service.key,
        type: "one_time_service",
        business_name: input.businessName || "",
        business_type: input.businessType || "",
        business_url: input.businessUrl || "",
        notes: input.notes || "",
      },
    });

    return { checkoutUrl: url };
  }),
});
