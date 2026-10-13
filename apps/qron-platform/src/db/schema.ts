import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";



export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    email: text('email'),
    fullName: text('full_name'),
    avatarUrl: text('avatarUrl'),
    company: text('company'),
    secondaryColor: text('secondaryColor'),
    apiKey: text('apiKey'),
    apiSecret: text('apiSecret'),
    tier: text('tier').default('free').notNull(),
    generationsUsed: integer('generations_used').default(0).notNull(),
    generationsLimit: integer('generations_limit').default(10).notNull(),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    affiliateId: text('affiliate_id').unique(),
    referredBy: text('referred_by'),
    storyModeEnabled: integer('story_mode_enabled', { mode: "boolean" }).default(false), // Added for Story Mode
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_profiles_user_id').on(table.userId),
    index('idx_profiles_stripe_customer').on(table.stripeCustomerId),
  ]
);

export const qrons = sqliteTable(
  'qrons',
  {
    id: integer('id').primaryKey(), // Actual DB uses serial integer
    userId: text('user_id').notNull(),
    name: text('name'),
    url: text('url'),
    shortCode: text('short_code'),
    scanCount: integer('scan_count').default(0).notNull(),
    folderId: integer('folder_id'),
    isActive: integer('is_active', { mode: "boolean" }).default(true).notNull(),
    mode: text('mode').default('standard').notNull(),
    targetUrl: text('target_url').notNull(),
    imageUrl: text('image_url').notNull(),
    prompt: text('prompt'),
    style: text('style', { mode: "json" }), // Actual DB uses jsonb for style
    isDemo: integer('is_demo', { mode: "boolean" }).default(false).notNull(),
    storyEnabled: integer('story_enabled', { mode: "boolean" }).default(false), // Added for Story Mode
    storyTier: text('story_tier'), // Added for Story Mode
    storyUnlockedAt: integer('story_unlocked_at', { mode: "timestamp" }), // Added for Story Mode
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_qrons_user_id').on(table.userId),
    index('idx_qrons_short_code').on(table.shortCode),
  ]
);

export const redirectRules = sqliteTable(
  'redirect_rules',
  {
    id: integer('id').primaryKey(),
    qronId: integer('qron_id').notNull(),
    name: text('name').notNull(),
    url: text('url'),
    priority: integer('priority').default(100).notNull(),
    ruleType: text('rule_type').notNull(),
    configuration: text('configuration', { mode: "json" }).default({}).notNull(),
    conditions: text('conditions', { mode: "json" }),
    weight: integer('weight'),
    isActive: integer('is_active', { mode: "boolean" }).default(true).notNull(),
    clickCount: integer('click_count').default(0),
    geoTargets: text('geo_targets', { mode: "json" }),
    deviceTargets: text('device_targets', { mode: "json" }),
    startTime: integer('start_time', { mode: "timestamp" }),
    endTime: integer('end_time', { mode: "timestamp" }),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_redirect_qron').on(table.qronId),
  ]
);

export const brands = sqliteTable(
  'brands',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    domain: text('domain'),
    logoUrl: text('logo_url'),
    industry: text('industry'),
    stakingTier: text('staking_tier').default('none').notNull(),
    qronStaked: text('qron_staked').default('0').notNull(),
    walletAddress: text('wallet_address'),
    unitCostDiscount: text('unit_cost_discount').default('0').notNull(),
    baseUnitCost: text('base_unit_cost').default('0.05').notNull(),
    isVerified: integer('is_verified', { mode: "boolean" }).default(false).notNull(),
    isActive: integer('is_active', { mode: "boolean" }).default(true).notNull(),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_brands_user').on(table.userId),
    index('idx_brands_domain').on(table.domain),
  ]
);

export const brandWebhooks = sqliteTable(
  'brand_webhooks',
  {
    id: text('id').primaryKey(),
    brandId: text('brand_id').notNull(),
    brand: text('brand').notNull(),
    endpointUrl: text('endpoint_url').notNull(),
    secretKey: text('secret_key').notNull(),
    events: text('events', { mode: "json" }).default(['qron_scanned']).notNull(),
    isActive: integer('is_active', { mode: "boolean" }).default(true).notNull(),
    deliveriesTotal: integer('deliveries_total').default(0),
    deliveriesFailed: integer('deliveries_failed').default(0),
    lastDeliveredAt: integer('last_delivered_at', { mode: "timestamp" }),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_brand_webhooks_brand').on(table.brandId),
  ]
);

// Minimal Products for now to avoid massive sprawl
export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    name: text('name').notNull(),
    description: text('description'),
    manufacturer: text('manufacturer'),
    modelNumber: text('model_number'),
    category: text('category'),
    metadata: text('metadata', { mode: "json" }).default({}),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  }
);

export const certifications = sqliteTable(
  'certifications',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id),
    userId: text('user_id'),
    name: text('name'),
    serialNumber: text('serial_number').notNull().unique(),
    status: text('status').default('pending').notNull(),
    qrImageUrl: text('qr_image_url'),
    sealSvgUrl: text('seal_svg_url'),
    approvedAt: integer('approved_at', { mode: "timestamp" }),
    issuedAt: integer('issued_at', { mode: "timestamp" }),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  }
);

export const dppData = sqliteTable(
  'dpp_data',
  {
    id: text('id').primaryKey(),
    certificationId: text('certification_id').notNull(),
    materialComposition: text('material_composition', { mode: "json" }),
    carbonFootprint: text('carbon_footprint'),
    repairabilityScore: text('repairability_score'),
    endOfLifeInstructions: text('end_of_life_instructions'),
    supplyChainProvenance: text('supply_chain_provenance', { mode: "json" }),
    lastUpdated: integer('last_updated', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  }
);

export const productLifecycleEvents = sqliteTable(
  'product_lifecycle_events',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id),
    eventType: text('event_type').notNull(), // 'manufactured', 'shipped', 'serviced', 'recycled'
    eventTimestamp: integer('event_timestamp', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    location: text('location'),
    actorId: text('actor_id'), // User/Company who performed action
    evidenceHash: text('evidence_hash'), // Hash of the event proof
    metadata: text('metadata', { mode: "json" }).default({}),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index('idx_lifecycle_product').on(table.productId),
  ]
);

export const componentProvenance = sqliteTable(
  'component_provenance',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id),
    componentName: text('component_name').notNull(),
    originCountry: text('origin_country'),
    supplierId: text('supplier_id'),
    materialCert: text('material_cert'), // Link to certificate
    anchoredTx: text('anchored_tx'), // Blockchain transaction hash
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index('idx_provenance_product').on(table.productId),
  ]
);


export const scanLogs = sqliteTable(
  'scan_logs',
  {
    id: text('id').primaryKey(),
    qronId: integer('qron_id'),
    ip: text('ip'),
    country: text('country'),
    region: text('region'),
    city: text('city'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  }
);

export const folders = sqliteTable(
  'folders',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  }
);

export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  }
);

export const qronTags = sqliteTable(
  'qron_tags',
  {
    qronId: integer('qron_id').notNull(),
    tagId: integer('tag_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.qronId, table.tagId] }),
  ]
);

export const qronGenerations = sqliteTable(
  'qron_generations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    url: text('url'),
    prompt: text('prompt'),
    mode: text('mode'),
    imageUrl: text('image_url'),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  }
);

export const telemetryEvents = sqliteTable(
  'telemetry_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    brandId: text('brand_id'),
    productId: text('product_id'),
    theater: text('theater').notNull(), // 'theater_1', 'theater_3', etc.
    rawPayload: text('raw_payload', { mode: "json" }).notNull(),
    parsedState: text('parsed_state', { mode: "json" }).notNull(),
    stateHash: text('state_hash').notNull(),
    anchoredTxHash: text('anchored_tx_hash'),
    timestamp: integer('timestamp', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_telemetry_theater').on(table.theater),
    index('idx_telemetry_hash').on(table.stateHash),
  ]
);

export const leadSequences = sqliteTable(
  'lead_sequences',
  {
    id: text('id').primaryKey(),
    leadId: text('lead_id').notNull(),
    currentStage: integer('current_stage').default(1).notNull(),
    status: text('status').default('active').notNull(), // 'active', 'paused', 'completed'
    lastActionAt: integer('last_action_at', { mode: "timestamp" }),
    nextActionAt: integer('next_action_at', { mode: "timestamp" }),
    metadata: text('metadata', { mode: "json" }).default({}),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_sequence_lead').on(table.leadId),
    index('idx_sequence_status').on(table.status),
  ]
);

export const livingArtSchedules = sqliteTable(
  'living_art_schedules',
  {
    id: integer('id').primaryKey(),
    qronId: integer('qron_id'),
    name: text('name'),
    scheduleType: text('schedule_type'),
    cronExpression: text('cron_expression'),
    images: text('images', { mode: "json" }),
    isActive: integer('is_active', { mode: "boolean" }),
    lastRunAt: integer('last_run_at', { mode: "timestamp" }),
    createdAt: integer('created_at', { mode: "timestamp" }),
    updatedAt: integer('updated_at', { mode: "timestamp" }),
  },
  (table) => [
    index('idx_living_art_qron').on(table.qronId),
  ]
);

export const whiteLabelClients = sqliteTable(
  'white_label_clients',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    domain: text('domain').unique(),
    logoUrl: text('logo_url'),
    primaryColor: text('primary_color'),
    secondaryColor: text('secondary_color'),
    apiKeyPrefix: text('api_key_prefix').unique(),
    billingPlan: text('billing_plan').default('reseller_standard').notNull(),
    isActive: integer('is_active', { mode: "boolean" }).default(true).notNull(),
    createdAt: integer('created_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updatedAt: integer('updated_at', { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (table) => [
    index('idx_white_label_domain').on(table.domain),
  ]
);
