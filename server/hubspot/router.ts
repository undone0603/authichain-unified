import { protectedProcedure, router } from "../_core/trpc";
import * as hubspot from "../hubspot-service";
import { z } from "zod";

export const hubspotRouter = router({
  status: protectedProcedure.query(async () => {
    if (!hubspot.isHubSpotConfigured()) return { connected: false, contacts: 0, companies: 0, deals: 0, error: "HUBSPOT_SERVICE_KEY is not configured. Add it in Settings → Secrets." };
    return await hubspot.getCRMStats();
  }),
  contacts: router({
    list: protectedProcedure.query(async () => {
      return await hubspot.listContacts();
    }),
    search: protectedProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
      return await hubspot.searchContacts(input.query);
    }),
    create: protectedProcedure.input(z.object({
      email: z.string().email(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
    })).mutation(async ({ input }) => {
      return await hubspot.createContact(input);
    }),
  }),
  companies: router({
    list: protectedProcedure.query(async () => {
      return await hubspot.listCompanies();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string(),
      domain: z.string().optional(),
      industry: z.string().optional(),
      description: z.string().optional(),
    })).mutation(async ({ input }) => {
      return await hubspot.createCompany(input);
    }),
  }),
  deals: router({
    list: protectedProcedure.query(async () => {
      return await hubspot.listDeals();
    }),
    create: protectedProcedure.input(z.object({
      dealname: z.string(),
      amount: z.string().optional(),
      pipeline: z.string().optional(),
      dealstage: z.string().optional(),
      closedate: z.string().optional(),
    })).mutation(async ({ input }) => {
      return await hubspot.createDeal(input);
    }),
  }),
});
