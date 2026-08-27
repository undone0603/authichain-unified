import { seoPages } from "../schema.js";
import { InferInsertModel } from "drizzle-orm";

export type InsertSeoPageRow = InferInsertModel<typeof seoPages>;
