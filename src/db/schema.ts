import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  pgEnum,
  index,
  boolean,
  jsonb,
  primaryKey,
  numeric,
} from 'drizzle-orm/pg-core';

export const tierEnum = pgEnum('tier', ['free', 'pro', 'enterprise']);

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id'),
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
    storyModeEnabled: boolean('story_mode_enabled').default(false), // Added for Story Mode
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_profiles_user_id').on(table.userId),
    index('idx_profiles_stripe_customer').on(table.stripeCustomerId),
  ]
);

export const qrons = pgTable(
  'qrons',
  {
    id: integer('id').primaryKey(), // Actual DB uses serial integer
    userId: uuid('user_id').notNull(),
    name: text('name'),
    url: text('url'),
    shortCode: text('short_code'),
    scanCount: integer('scan_count').default(0).notNull(),
    folderId: integer('folder_id'),
    isActive: boolean('is_active').default(true).notNull(),
    mode: text('mode').default('standard').notNull(),
    targetUrl: text('target_url').notNull(),
    imageUrl: text('image_url').notNull(),
    prompt: text('prompt'),
    style: jsonb('style'), // Actual DB uses jsonb for style
    isDemo: boolean('is_demo').default(false).notNull(),
    storyEnabled: boolean('story_enabled').default(false), // Added for Story Mode
    storyTier: text('story_tier'), // Added for Story Mode
    storyUnlockedAt: timestamp('story_unlocked_at'), // Added for Story Mode
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_qrons_user_id').on(table.userId),
    index('idx_qrons_short_code').on(table.shortCode),
  ]
);

export const redirectRules = pgTable(
  'redirect_rules',
  {
    id: integer('id').primaryKey(),
    qronId: integer('qron_id').notNull(),
    name: text('name').notNull(),
    url: text('url'),
    priority: integer('priority').default(100).notNull(),
    ruleType: text('rule_type').notNull(),
    configuration: jsonb('configuration').default({}).notNull(),
    conditions: jsonb('conditions'),
    weight: integer('weight'),
    isActive: boolean('is_active').default(true).notNull(),
    clickCount: integer('click_count').default(0),
    geoTargets: text('geo_targets').array(),
    deviceTargets: text('device_targets').array(),
    startTime: timestamp('start_time'),
    endTime: timestamp('end_time'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_redirect_qron').on(table.qronId),
  ]
);

export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    domain: text('domain'),
    logoUrl: text('logo_url'),
    industry: text('industry'),
    stakingTier: text('staking_tier').default('none').notNull(),
    qronStaked: numeric('qron_staked').default('0').notNull(),
    walletAddress: text('wallet_address'),
    unitCostDiscount: numeric('unit_cost_discount').default('0').notNull(),
    baseUnitCost: numeric('base_unit_cost').default('0.05').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_brands_user').on(table.userId),
    index('idx_brands_domain').on(table.domain),
  ]
);

export const brandWebhooks = pgTable(
  'brand_webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').notNull(),
    brand: text('brand'),
    endpointUrl: text('endpoint_url').notNull(),
    secretKey: text('secret_key').notNull(),
    events: text('events').array().default(['qron_scanned']).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    deliveriesTotal: integer('deliveries_total').default(0),
    deliveriesFailed: integer('deliveries_failed').default(0),
    lastDeliveredAt: timestamp('last_delivered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_brand_webhooks_brand').on(table.brandId),
  ]
);

// Minimal Products for now to avoid massive sprawl
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    name: text('name').notNull(),
    description: text('description'),
    manufacturer: text('manufacturer'),
    modelNumber: text('model_number'),
    category: text('category'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  }
);

export const certifications = pgTable(
  'certifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id),
    userId: uuid('user_id'),
    name: text('name'),
    serialNumber: text('serial_number').notNull().unique(),
    status: text('status').default('pending').notNull(),
    qrImageUrl: text('qr_image_url'),
    sealSvgUrl: text('seal_svg_url'),
    approvedAt: timestamp('approved_at'),
    issuedAt: timestamp('issued_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  }
);

export const dppData = pgTable(
  'dpp_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    certificationId: uuid('certification_id').notNull(),
    materialComposition: jsonb('material_composition'),
    carbonFootprint: numeric('carbon_footprint'),
    repairabilityScore: numeric('repairability_score'),
    endOfLifeInstructions: text('end_of_life_instructions'),
    supplyChainProvenance: jsonb('supply_chain_provenance'),
    lastUpdated: timestamp('last_updated').defaultNow(),
  }
);

export const scanLogs = pgTable(
  'scan_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    qronId: integer('qron_id'),
    ip: text('ip'),
    country: text('country'),
    region: text('region'),
    city: text('city'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow(),
  }
);

export const folders = pgTable(
  'folders',
  {
    id: integer('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

export const tags = pgTable(
  'tags',
  {
    id: integer('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

export const qronTags = pgTable(
  'qron_tags',
  {
    qronId: integer('qron_id').notNull(),
    tagId: integer('tag_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.qronId, table.tagId] }),
  ]
);

export const qronGenerations = pgTable(
  'qron_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    url: text('url'),
    prompt: text('prompt'),
    mode: text('mode'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    brandId: uuid('brand_id'),
    productId: uuid('product_id'),
    theater: text('theater').notNull(), // 'theater_1', 'theater_3', etc.
    rawPayload: jsonb('raw_payload').notNull(),
    parsedState: jsonb('parsed_state').notNull(),
    stateHash: text('state_hash').notNull(),
    anchoredTxHash: text('anchored_tx_hash'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_telemetry_theater').on(table.theater),
    index('idx_telemetry_hash').on(table.stateHash),
  ]
);
