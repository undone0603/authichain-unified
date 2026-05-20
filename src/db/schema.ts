import {
  serial,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  numeric,
  bigint,
  uuid,
  pgEnum,
  index,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

// â”€â”€â”€ Enums â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const tierEnum = pgEnum('tier', ['free', 'pro', 'enterprise']);

// â”€â”€â”€ Users & Profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Merged from both schemas
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  openId: varchar('openId', { length: 64 }).notNull().unique(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  walletAddress: varchar('walletAddress', { length: 128 }),
  avatarUrl: text('avatarUrl'),
  company: varchar('company', { length: 256 }),
  title: varchar('title', { length: 256 }),
  phone: varchar('phone', { length: 32 }),
  onboardingCompleted: integer('onboardingCompleted').default(0),
  stripeCustomerId: varchar('stripeCustomerId', { length: 128 }).unique(),
  paddleCustomerId: varchar('paddleCustomerId', { length: 128 }),
  points: integer('points').default(0),
  // QRON specific fields
  generationsUsed: integer('generations_used').default(0).notNull(),
  generationsLimit: integer('generations_limit').default(10).notNull(),
  affiliateId: text('affiliate_id').unique(),
  referredBy: text('referred_by'),
  storyModeEnabled: boolean('story_mode_enabled').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// â”€â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull(),
  name: varchar('name', { length: 512 }).notNull(),
  brand: varchar('brand', { length: 256 }),
  category: varchar('category', { length: 128 }),
  description: text('description'),
  imageUrl: text('imageUrl'),
  serialNumber: varchar('serialNumber', { length: 256 }),
  batchNumber: varchar('batchNumber', { length: 256 }),
  manufacturingDate: timestamp('manufacturingDate'),
  blockchainTxHash: varchar('blockchainTxHash', { length: 128 }),
  nftTokenId: varchar('nftTokenId', { length: 128 }),
  status: varchar('status', { length: 50 }).default('active'),
  // QRON specific fields
  manufacturer: text('manufacturer'),
  modelNumber: text('model_number'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// â”€â”€â”€ Authentications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const authentications = pgTable('authentications', {
  id: serial('id').primaryKey(),
  productId: integer('productId').notNull(),
  userId: integer('userId').notNull(),
  result: varchar('result', { length: 50 }).notNull(),
  confidenceScore: integer('confidenceScore').notNull(),
  aiAnalysis: json('aiAnalysis'),
  imageUrl: text('imageUrl'),
  isPublic: integer('isPublic').default(0),
  shareToken: varchar('shareToken', { length: 128 }),
  shareCount: integer('shareCount').default(0),
  verificationMethod: varchar('verificationMethod', { length: 64 }).default('ai_image'),
  blockchainVerified: integer('blockchainVerified').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type Authentication = typeof authentications.$inferSelect;

// â”€â”€â”€ Certificates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const certificates = pgTable('certificates', {
  id: serial('id').primaryKey(),
  productId: integer('productId').notNull(),
  authenticationId: integer('authenticationId'),
  userId: integer('userId').notNull(),
  certificateNumber: varchar('certificateNumber', { length: 64 }).notNull().unique(),
  status: varchar('status', { length: 50 }).default('active'),
  issuedAt: timestamp('issuedAt').defaultNow().notNull(),
  expiresAt: timestamp('expiresAt'),
  blockchainTxHash: varchar('blockchainTxHash', { length: 128 }),
  nftTokenId: varchar('nftTokenId', { length: 256 }),
  nftContractAddress: varchar('nftContractAddress', { length: 64 }),
  certificateUrl: text('certificateUrl'),
  metadata: json('metadata'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;

// â”€â”€â”€ QR Codes & QRONs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const qrCodes = pgTable('qr_codes', {
  id: serial('id').primaryKey(),
  productId: integer('productId'),
  userId: integer('userId').notNull(),
  name: text('name'),
  url: text('url'),
  shortCode: text('short_code'),
  qrData: text('qrData').notNull(),
  qrImageUrl: text('qrImageUrl'),
  scanCount: integer('scanCount').default(0),
  lastScannedAt: timestamp('lastScannedAt'),
  mode: text('mode').default('standard').notNull(),
  targetUrl: text('target_url'),
  imageUrl: text('image_url'),
  prompt: text('prompt'),
  style: jsonb('style'),
  isDemo: boolean('is_demo').default(false).notNull(),
  storyEnabled: boolean('story_enabled').default(false),
  storyTier: text('story_tier'),
  storyUnlockedAt: timestamp('story_unlocked_at'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => [
  index('idx_qrcodes_user_id').on(table.userId),
  index('idx_qrcodes_short_code').on(table.shortCode),
]);

export type QrCode = typeof qrCodes.$inferSelect;

// â”€â”€â”€ Redirect Rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const redirectRules = pgTable(
  'redirect_rules',
  {
    id: serial('id').primaryKey(),
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

// â”€â”€â”€ Brands â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id'), // Linked to users.id
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
    index('idx_brands_domain').on(table.domain),
  ]
);

// â”€â”€â”€ Telemetry Events (Phase 2 & Theater 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id'),
    brandId: uuid('brand_id'),
    productId: integer('product_id'),
    theater: text('theater').notNull(), // 'theater_1', 'theater_3', etc.
    source: text('source'),
    metrcTag: text('metrc_tag'),
    rawPayload: jsonb('raw_payload').notNull(),
    parsedState: jsonb('parsed_state').notNull(),
    ledgerHash: text('ledger_hash'),
    stateHash: text('state_hash'),
    anchoredTxHash: text('anchored_tx_hash'),
    isCompliant: boolean('is_compliant'),
    gpsLocation: jsonb('gps_location'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_telemetry_theater').on(table.theater),
    index('idx_telemetry_hash').on(table.stateHash),
  ]
);

// â”€â”€â”€ Supply Chain Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const supplyChainEvents = pgTable('supply_chain_events', {
  id: serial('id').primaryKey(),
  productId: integer('productId').notNull(),
  eventType: varchar('eventType', { length: 50 }).notNull(),
  location: varchar('location', { length: 512 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  temperature: numeric('temperature', { precision: 5, scale: 2 }),
  humidity: numeric('humidity', { precision: 5, scale: 2 }),
  handler: varchar('handler', { length: 256 }),
  notes: text('notes'),
  blockchainTxHash: varchar('blockchainTxHash', { length: 128 }),
  iotDeviceId: varchar('iotDeviceId', { length: 128 }),
  metadata: json('metadata'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// â”€â”€â”€ Subscriptions & Billing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull(),
  plan: varchar('plan', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  monthlyQuota: integer('monthlyQuota').notNull(),
  usedQuota: integer('usedQuota').default(0),
  stripeCustomerId: varchar('stripeCustomerId', { length: 128 }),
  stripeSubscriptionId: varchar('stripeSubscriptionId', { length: 128 }),
  paddleSubscriptionId: varchar('paddleSubscriptionId', { length: 128 }),
  paddleCustomerId: varchar('paddleCustomerId', { length: 128 }),
  billingCycle: varchar('billingCycle', { length: 50 }).default('monthly'),
  currentPeriodStart: timestamp('currentPeriodStart'),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  trialEndsAt: timestamp('trialEndsAt'),
  cancelledAt: timestamp('cancelledAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});



    i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     s u b s c r i p t i o n I d :   i n t e g e r ( " s u b s c r i p t i o n I d " ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     q u a n t i t y :   i n t e g e r ( " q u a n t i t y " ) . d e f a u l t ( 1 ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   I n v o i c e s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   i n v o i c e s   =   p g T a b l e ( " i n v o i c e s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     s u b s c r i p t i o n I d :   i n t e g e r ( " s u b s c r i p t i o n I d " ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   1 0 ,   s c a l e :   2   } ) . n o t N u l l ( ) ,  
     c u r r e n c y :   v a r c h a r ( " c u r r e n c y " ,   {   l e n g t h :   8   } ) . d e f a u l t ( " U S D " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " d r a f t " ) ,  
     s t r i p e I n v o i c e I d :   v a r c h a r ( " s t r i p e I n v o i c e I d " ,   {   l e n g t h :   1 2 8   } ) ,  
     p a i d A t :   t i m e s t a m p ( " p a i d A t " ) ,  
     d u e D a t e :   t i m e s t a m p ( " d u e D a t e " ) ,  
     i t e m s :   j s o n ( " i t e m s " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   I n v o i c e   =   t y p e o f   i n v o i c e s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   P a y m e n t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   p a y m e n t s   =   p g T a b l e ( " p a y m e n t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   8   } ) . n o t N u l l ( ) ,  
     c u r r e n c y :   v a r c h a r ( " c u r r e n c y " ,   {   l e n g t h :   1 6   } ) . d e f a u l t ( " U S D " ) ,  
     m e t h o d :   v a r c h a r ( " m e t h o d " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     s t r i p e P a y m e n t I d :   v a r c h a r ( " s t r i p e P a y m e n t I d " ,   {   l e n g t h :   1 2 8   } ) ,  
     c r y p t o P a y m e n t I d :   v a r c h a r ( " c r y p t o P a y m e n t I d " ,   {   l e n g t h :   1 2 8   } ) ,  
     c r y p t o A d d r e s s :   v a r c h a r ( " c r y p t o A d d r e s s " ,   {   l e n g t h :   2 5 6   } ) ,  
     e s c r o w R e l e a s e D a t e :   t i m e s t a m p ( " e s c r o w R e l e a s e D a t e " ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   P a y m e n t   =   t y p e o f   p a y m e n t s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   L e a d s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   l e a d s   =   p g T a b l e ( " l e a d s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     e m a i l :   v a r c h a r ( " e m a i l " ,   {   l e n g t h :   3 2 0   } ) . n o t N u l l ( ) ,  
     n a m e :   v a r c h a r ( " n a m e " ,   {   l e n g t h :   2 5 6   } ) ,  
     c o m p a n y :   v a r c h a r ( " c o m p a n y " ,   {   l e n g t h :   2 5 6   } ) ,  
     t i t l e :   v a r c h a r ( " t i t l e " ,   {   l e n g t h :   2 5 6   } ) ,  
     p h o n e :   v a r c h a r ( " p h o n e " ,   {   l e n g t h :   3 2   } ) ,  
     s o u r c e :   v a r c h a r ( " s o u r c e " ,   {   l e n g t h :   1 2 8   } ) ,  
     s c o r e :   i n t e g e r ( " s c o r e " ) . d e f a u l t ( 0 ) ,  
     l e a d S c o r e :   i n t e g e r ( " l e a d S c o r e " ) . d e f a u l t ( 0 ) ,  
     e m a i l O p e n e d :   b o o l e a n ( " e m a i l O p e n e d " ) . d e f a u l t ( f a l s e ) ,  
     e m a i l C l i c k e d :   b o o l e a n ( " e m a i l C l i c k e d " ) . d e f a u l t ( f a l s e ) ,  
     e m a i l R e p l i e d :   b o o l e a n ( " e m a i l R e p l i e d " ) . d e f a u l t ( f a l s e ) ,  
     r o i C a l c u l a t e d :   b o o l e a n ( " r o i C a l c u l a t e d " ) . d e f a u l t ( f a l s e ) ,  
     d e m o S t a r t e d :   b o o l e a n ( " d e m o S t a r t e d " ) . d e f a u l t ( f a l s e ) ,  
     i n t e r a c t i o n s C o u n t :   i n t e g e r ( " i n t e r a c t i o n s C o u n t " ) . d e f a u l t ( 0 ) ,  
     i s V i p :   b o o l e a n ( " i s V i p " ) . d e f a u l t ( f a l s e ) ,  
     c o n t r a c t S e n t :   b o o l e a n ( " c o n t r a c t S e n t " ) . d e f a u l t ( f a l s e ) ,  
     c o n t r a c t O p e n e d :   b o o l e a n ( " c o n t r a c t O p e n e d " ) . d e f a u l t ( f a l s e ) ,  
     c o n t r a c t S i g n e d :   b o o l e a n ( " c o n t r a c t S i g n e d " ) . d e f a u l t ( f a l s e ) ,  
     r o i S a v i n g s :   i n t e g e r ( " r o i S a v i n g s " ) ,  
     n u m P r o d u c t s :   i n t e g e r ( " n u m P r o d u c t s " ) ,  
     d e a l S t a g e :   v a r c h a r ( " d e a l S t a g e " ,   {   l e n g t h :   6 4   } ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " n e w " ) ,  
     i n d u s t r y :   v a r c h a r ( " i n d u s t r y " ,   {   l e n g t h :   1 2 8   } ) ,  
     n o t e s :   t e x t ( " n o t e s " ) ,  
     l a s t C o n t a c t e d A t :   t i m e s t a m p ( " l a s t C o n t a c t e d A t " ) ,  
     a s s i g n e d T o :   i n t e g e r ( " a s s i g n e d T o " ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   L e a d   =   t y p e o f   l e a d s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   E m a i l   C a m p a i g n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   e m a i l C a m p a i g n s   =   p g T a b l e ( " e m a i l _ c a m p a i g n s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     n a m e :   v a r c h a r ( " n a m e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     s u b j e c t :   v a r c h a r ( " s u b j e c t " ,   {   l e n g t h :   5 1 2   } ) . n o t N u l l ( ) ,  
     b o d y :   t e x t ( " b o d y " ) . n o t N u l l ( ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " d r a f t " ) ,  
     r e c i p i e n t C o u n t :   i n t e g e r ( " r e c i p i e n t C o u n t " ) . d e f a u l t ( 0 ) ,  
     s e n t C o u n t :   i n t e g e r ( " s e n t C o u n t " ) . d e f a u l t ( 0 ) ,  
     o p e n C o u n t :   i n t e g e r ( " o p e n C o u n t " ) . d e f a u l t ( 0 ) ,  
     c l i c k C o u n t :   i n t e g e r ( " c l i c k C o u n t " ) . d e f a u l t ( 0 ) ,  
     b o u n c e C o u n t :   i n t e g e r ( " b o u n c e C o u n t " ) . d e f a u l t ( 0 ) ,  
     s c h e d u l e d A t :   t i m e s t a m p ( " s c h e d u l e d A t " ) ,  
     s e n t A t :   t i m e s t a m p ( " s e n t A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   E m a i l C a m p a i g n   =   t y p e o f   e m a i l C a m p a i g n s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   E m a i l   D r a f t s   ( A p p r o v a l   W o r k f l o w )   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   e m a i l D r a f t s   =   p g T a b l e ( " e m a i l _ d r a f t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     p r o s p e c t N a m e :   v a r c h a r ( " p r o s p e c t N a m e " ,   {   l e n g t h :   2 5 6   } ) ,  
     p r o s p e c t E m a i l :   v a r c h a r ( " p r o s p e c t E m a i l " ,   {   l e n g t h :   3 2 0   } ) . n o t N u l l ( ) ,  
     p r o s p e c t C o m p a n y :   v a r c h a r ( " p r o s p e c t C o m p a n y " ,   {   l e n g t h :   2 5 6   } ) ,  
     p r o s p e c t T i t l e :   v a r c h a r ( " p r o s p e c t T i t l e " ,   {   l e n g t h :   2 5 6   } ) ,  
     i n d u s t r y :   v a r c h a r ( " i n d u s t r y " ,   {   l e n g t h :   1 2 8   } ) ,  
     s u b j e c t :   v a r c h a r ( " s u b j e c t " ,   {   l e n g t h :   5 1 2   } ) . n o t N u l l ( ) ,  
     b o d y :   t e x t ( " b o d y " ) . n o t N u l l ( ) ,  
     t e m p l a t e U s e d :   v a r c h a r ( " t e m p l a t e U s e d " ,   {   l e n g t h :   1 2 8   } ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     g e n e r a t e d B y :   v a r c h a r ( " g e n e r a t e d B y " ,   {   l e n g t h :   6 4   } ) . d e f a u l t ( " a i _ m a n a g e r " ) ,  
     a p p r o v e d B y :   i n t e g e r ( " a p p r o v e d B y " ) ,  
     a p p r o v e d A t :   t i m e s t a m p ( " a p p r o v e d A t " ) ,  
     s e n t A t :   t i m e s t a m p ( " s e n t A t " ) ,  
     n o t e s :   t e x t ( " n o t e s " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   E m a i l D r a f t   =   t y p e o f   e m a i l D r a f t s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   S u p p l y   C h a i n   E v e n t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   s u p p l y C h a i n E v e n t s   =   p g T a b l e ( " s u p p l y _ c h a i n _ e v e n t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     p r o d u c t I d :   i n t e g e r ( " p r o d u c t I d " ) . n o t N u l l ( ) ,  
     e v e n t T y p e :   v a r c h a r ( " e v e n t T y p e " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     l o c a t i o n :   v a r c h a r ( " l o c a t i o n " ,   {   l e n g t h :   5 1 2   } ) ,  
     l a t i t u d e :   n u m e r i c ( " l a t i t u d e " ,   {   p r e c i s i o n :   1 0 ,   s c a l e :   7   } ) ,  
     l o n g i t u d e :   n u m e r i c ( " l o n g i t u d e " ,   {   p r e c i s i o n :   1 0 ,   s c a l e :   7   } ) ,  
     t e m p e r a t u r e :   n u m e r i c ( " t e m p e r a t u r e " ,   {   p r e c i s i o n :   5 ,   s c a l e :   2   } ) ,  
     h u m i d i t y :   n u m e r i c ( " h u m i d i t y " ,   {   p r e c i s i o n :   5 ,   s c a l e :   2   } ) ,  
     h a n d l e r :   v a r c h a r ( " h a n d l e r " ,   {   l e n g t h :   2 5 6   } ) ,  
     n o t e s :   t e x t ( " n o t e s " ) ,  
     b l o c k c h a i n T x H a s h :   v a r c h a r ( " b l o c k c h a i n T x H a s h " ,   {   l e n g t h :   1 2 8   } ) ,  
     i o t D e v i c e I d :   v a r c h a r ( " i o t D e v i c e I d " ,   {   l e n g t h :   1 2 8   } ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   S u p p l y C h a i n E v e n t   =   t y p e o f   s u p p l y C h a i n E v e n t s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   R e f e r r a l s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   r e f e r r a l s   =   p g T a b l e ( " r e f e r r a l s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     r e f e r r e r I d :   i n t e g e r ( " r e f e r r e r I d " ) . n o t N u l l ( ) ,  
     r e f e r r e d I d :   i n t e g e r ( " r e f e r r e d I d " ) ,  
     r e f e r r a l C o d e :   v a r c h a r ( " r e f e r r a l C o d e " ,   {   l e n g t h :   3 2   } ) . n o t N u l l ( ) . u n i q u e ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     r e w a r d A m o u n t :   n u m e r i c ( " r e w a r d A m o u n t " ,   {   p r e c i s i o n :   1 0 ,   s c a l e :   2   } ) . d e f a u l t ( " 0 " ) ,  
     r e w a r d P a i d :   i n t e g e r ( " r e w a r d P a i d " ) . d e f a u l t ( 0 ) ,  
     r e f e r r e d E m a i l :   v a r c h a r ( " r e f e r r e d E m a i l " ,   {   l e n g t h :   3 2 0   } ) ,  
     t i e r :   v a r c h a r ( " t i e r " ,   {   l e n g t h :   5 0   } ) ,  
     c o m m i s s i o n P a i d :   n u m e r i c ( " c o m m i s s i o n P a i d " ,   {   p r e c i s i o n :   1 0 ,   s c a l e :   2   } ) . d e f a u l t ( " 0 " ) ,  
     c o n v e r t e d A t :   t i m e s t a m p ( " c o n v e r t e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   R e f e r r a l   =   t y p e o f   r e f e r r a l s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A f f i l i a t e s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a f f i l i a t e s   =   p g T a b l e ( " a f f i l i a t e s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     a f f i l i a t e C o d e :   v a r c h a r ( " a f f i l i a t e C o d e " ,   {   l e n g t h :   3 2   } ) . n o t N u l l ( ) . u n i q u e ( ) ,  
     c o m m i s s i o n R a t e :   n u m e r i c ( " c o m m i s s i o n R a t e " ,   {   p r e c i s i o n :   5 ,   s c a l e :   2   } ) . d e f a u l t ( " 1 0 . 0 0 " ) ,  
     t o t a l E a r n i n g s :   n u m e r i c ( " t o t a l E a r n i n g s " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   2   } ) . d e f a u l t ( " 0 " ) ,  
     p e n d i n g P a y o u t :   n u m e r i c ( " p e n d i n g P a y o u t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   2   } ) . d e f a u l t ( " 0 " ) ,  
     t o t a l R e f e r r a l s :   i n t e g e r ( " t o t a l R e f e r r a l s " ) . d e f a u l t ( 0 ) ,  
     t o t a l C o n v e r s i o n s :   i n t e g e r ( " t o t a l C o n v e r s i o n s " ) . d e f a u l t ( 0 ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     t i e r :   v a r c h a r ( " a f f i l i a t e T i e r " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " b a s i c " ) ,  
     a c t i v e R e f e r r a l s :   i n t e g e r ( " a c t i v e R e f e r r a l s " ) . d e f a u l t ( 0 ) ,  
     p a y p a l E m a i l :   v a r c h a r ( " p a y p a l E m a i l " ,   {   l e n g t h :   3 2 0   } ) ,  
     p a y o u t M e t h o d :   v a r c h a r ( " p a y o u t M e t h o d " ,   {   l e n g t h :   6 4   } ) ,  
     p a y o u t D e t a i l s :   j s o n ( " p a y o u t D e t a i l s " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   A f f i l i a t e   =   t y p e o f   a f f i l i a t e s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A f f i l i a t e   C o m m i s s i o n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a f f i l i a t e C o m m i s s i o n s   =   p g T a b l e ( " a f f i l i a t e _ c o m m i s s i o n s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     a f f i l i a t e I d :   i n t e g e r ( " a f f i l i a t e I d " ) . n o t N u l l ( ) ,  
     p a y m e n t I d :   i n t e g e r ( " p a y m e n t I d " ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   2   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     p a i d A t :   t i m e s t a m p ( " p a i d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A u t o p i l o t   C o n f i g   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a u t o p i l o t C o n f i g   =   p g T a b l e ( " a u t o p i l o t _ c o n f i g " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     e n a b l e d :   i n t e g e r ( " e n a b l e d " ) . d e f a u l t ( 0 ) ,  
     m o d e :   v a r c h a r ( " m o d e " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " b a l a n c e d " ) ,  
     g u a r d r a i l s :   j s o n ( " g u a r d r a i l s " ) ,  
     u p d a t e d B y :   i n t e g e r ( " u p d a t e d B y " ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   A u t o p i l o t C o n f i g   =   t y p e o f   a u t o p i l o t C o n f i g . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A u t o p i l o t   D e c i s i o n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a u t o p i l o t D e c i s i o n s   =   p g T a b l e ( " a u t o p i l o t _ d e c i s i o n s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     a c t i o n :   v a r c h a r ( " a c t i o n " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     r e a s o n i n g :   t e x t ( " r e a s o n i n g " ) ,  
     c o n f i d e n c e :   i n t e g e r ( " c o n f i d e n c e " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     r e s u l t :   j s o n ( " r e s u l t " ) ,  
     o v e r r i d d e n B y :   i n t e g e r ( " o v e r r i d d e n B y " ) ,  
     o v e r r i d e R e a s o n :   t e x t ( " o v e r r i d e R e a s o n " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   A u t o p i l o t D e c i s i o n   =   t y p e o f   a u t o p i l o t D e c i s i o n s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A / B   T e s t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a b T e s t s   =   p g T a b l e ( " a b _ t e s t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     n a m e :   v a r c h a r ( " n a m e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     d e s c r i p t i o n :   t e x t ( " d e s c r i p t i o n " ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " d r a f t " ) ,  
     v a r i a n t s :   j s o n ( " v a r i a n t s " ) ,  
     w i n n e r V a r i a n t :   v a r c h a r ( " w i n n e r V a r i a n t " ,   {   l e n g t h :   6 4   } ) ,  
     t o t a l P a r t i c i p a n t s :   i n t e g e r ( " t o t a l P a r t i c i p a n t s " ) . d e f a u l t ( 0 ) ,  
     s t a r t e d A t :   t i m e s t a m p ( " s t a r t e d A t " ) ,  
     e n d e d A t :   t i m e s t a m p ( " e n d e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   A b T e s t   =   t y p e o f   a b T e s t s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   W h i t e   L a b e l   C l i e n t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   w h i t e L a b e l C l i e n t s   =   p g T a b l e ( " w h i t e _ l a b e l _ c l i e n t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     c o m p a n y N a m e :   v a r c h a r ( " c o m p a n y N a m e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     d o m a i n :   v a r c h a r ( " d o m a i n " ,   {   l e n g t h :   2 5 6   } ) ,  
     l o g o U r l :   t e x t ( " l o g o U r l " ) ,  
     p r i m a r y C o l o r :   v a r c h a r ( " p r i m a r y C o l o r " ,   {   l e n g t h :   1 6   } ) ,  
     s e c o n d a r y C o l o r :   v a r c h a r ( " s e c o n d a r y C o l o r " ,   {   l e n g t h :   1 6   } ) ,  
     a p i K e y :   v a r c h a r ( " a p i K e y " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) . u n i q u e ( ) ,  
     a p i S e c r e t :   v a r c h a r ( " a p i S e c r e t " ,   {   l e n g t h :   2 5 6   } ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     m o n t h l y A p i C a l l s :   i n t e g e r ( " m o n t h l y A p i C a l l s " ) . d e f a u l t ( 0 ) ,  
     a p i C a l l L i m i t :   i n t e g e r ( " a p i C a l l L i m i t " ) . d e f a u l t ( 1 0 0 0 0 ) ,  
     f e a t u r e s :   j s o n ( " f e a t u r e s " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   W h i t e L a b e l C l i e n t   =   t y p e o f   w h i t e L a b e l C l i e n t s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A P I   U s a g e   ( D a i l y )   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a p i U s a g e D a i l y   =   p g T a b l e ( " a p i _ u s a g e _ d a i l y " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     c l i e n t I d :   i n t e g e r ( " c l i e n t I d " ) . n o t N u l l ( ) ,  
     d a t e :   t i m e s t a m p ( " d a t e " ) . n o t N u l l ( ) ,  
     c a l l s :   i n t e g e r ( " c a l l s " ) . d e f a u l t ( 0 ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A c t i v i t y   L o g   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a c t i v i t y L o g   =   p g T a b l e ( " a c t i v i t y _ l o g " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) ,  
     a c t i o n :   v a r c h a r ( " a c t i o n " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) ,  
     e n t i t y T y p e :   v a r c h a r ( " e n t i t y T y p e " ,   {   l e n g t h :   6 4   } ) ,  
     e n t i t y I d :   i n t e g e r ( " e n t i t y I d " ) ,  
     d e t a i l s :   j s o n ( " d e t a i l s " ) ,  
     i p A d d r e s s :   v a r c h a r ( " i p A d d r e s s " ,   {   l e n g t h :   6 4   } ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   F r a u d   A l e r t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   f r a u d A l e r t s   =   p g T a b l e ( " f r a u d _ a l e r t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) ,  
     p r o d u c t I d :   i n t e g e r ( " p r o d u c t I d " ) ,  
     a l e r t T y p e :   v a r c h a r ( " a l e r t T y p e " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) ,  
     s e v e r i t y :   v a r c h a r ( " s e v e r i t y " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " m e d i u m " ) ,  
     d e s c r i p t i o n :   t e x t ( " d e s c r i p t i o n " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " o p e n " ) ,  
     r e s o l v e d B y :   i n t e g e r ( " r e s o l v e d B y " ) ,  
     r e s o l v e d A t :   t i m e s t a m p ( " r e s o l v e d A t " ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   F r a u d A l e r t   =   t y p e o f   f r a u d A l e r t s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   C u s t o m e r   H e a l t h   S c o r e s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   c u s t o m e r H e a l t h S c o r e s   =   p g T a b l e ( " c u s t o m e r _ h e a l t h _ s c o r e s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     s c o r e :   i n t e g e r ( " s c o r e " ) . n o t N u l l ( ) ,  
     f a c t o r s :   j s o n ( " f a c t o r s " ) ,  
     t r e n d :   v a r c h a r ( " t r e n d " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " s t a b l e " ) ,  
     l a s t C a l c u l a t e d A t :   t i m e s t a m p ( " l a s t C a l c u l a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   R e v e n u e   R e c o r d s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   r e v e n u e R e c o r d s   =   p g T a b l e ( " r e v e n u e _ r e c o r d s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     s o u r c e :   v a r c h a r ( " s o u r c e " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   2   } ) . n o t N u l l ( ) ,  
     c u r r e n c y :   v a r c h a r ( " c u r r e n c y " ,   {   l e n g t h :   8   } ) . d e f a u l t ( " U S D " ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   N o t i f i c a t i o n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   n o t i f i c a t i o n s   =   p g T a b l e ( " n o t i f i c a t i o n s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     t i t l e :   v a r c h a r ( " t i t l e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     m e s s a g e :   t e x t ( " m e s s a g e " ) . n o t N u l l ( ) ,  
     i s R e a d :   i n t e g e r ( " i s R e a d " ) . d e f a u l t ( 0 ) . n o t N u l l ( ) ,  
     a c t i o n U r l :   v a r c h a r ( " a c t i o n U r l " ,   {   l e n g t h :   5 1 2   } ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   N o t i f i c a t i o n   =   t y p e o f   n o t i f i c a t i o n s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t N o t i f i c a t i o n   =   t y p e o f   n o t i f i c a t i o n s . $ i n f e r I n s e r t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   B o n u s e s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   b o n u s e s   =   p g T a b l e ( " b o n u s e s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     b o n u s T y p e :   v a r c h a r ( " b o n u s T y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     b o n u s N a m e :   v a r c h a r ( " b o n u s N a m e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     b o n u s V a l u e :   i n t e g e r ( " b o n u s V a l u e " ) . n o t N u l l ( ) ,  
     t i e r :   v a r c h a r ( " b o n u s T i e r " ,   {   l e n g t h :   5 0   } ) ,  
     s t a t u s :   v a r c h a r ( " b o n u s S t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     d e l i v e r y M e t h o d :   v a r c h a r ( " d e l i v e r y M e t h o d " ,   {   l e n g t h :   6 4   } ) ,  
     c l a i m e d A t :   t i m e s t a m p ( " c l a i m e d A t " ) ,  
     d e l i v e r e d A t :   t i m e s t a m p ( " d e l i v e r e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   B o n u s   =   t y p e o f   b o n u s e s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   R e f e r r a l   C l i c k s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   r e f e r r a l C l i c k s   =   p g T a b l e ( " r e f e r r a l _ c l i c k s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     r e f e r r a l C o d e :   v a r c h a r ( " r e f e r r a l C o d e " ,   {   l e n g t h :   3 2   } ) . n o t N u l l ( ) ,  
     i p A d d r e s s :   v a r c h a r ( " i p A d d r e s s " ,   {   l e n g t h :   6 4   } ) ,  
     u s e r A g e n t :   t e x t ( " u s e r A g e n t " ) ,  
     r e f e r e r :   t e x t ( " r e f e r e r " ) ,  
     l a n d i n g P a g e :   t e x t ( " l a n d i n g P a g e " ) ,  
     c o n v e r t e d A t :   t i m e s t a m p ( " c o n v e r t e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   A I   M o d e l s   ( M a r k e t p l a c e )   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   a i M o d e l s   =   p g T a b l e ( " a i _ m o d e l s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     n a m e :   v a r c h a r ( " n a m e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     d e s c r i p t i o n :   t e x t ( " d e s c r i p t i o n " ) ,  
     c a t e g o r y :   v a r c h a r ( " c a t e g o r y " ,   {   l e n g t h :   1 2 8   } ) ,  
     p r i c e :   i n t e g e r ( " p r i c e " ) . n o t N u l l ( ) . d e f a u l t ( 0 ) ,  
     s t a t u s :   v a r c h a r ( " m o d e l S t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " d r a f t " ) ,  
     d o w n l o a d s :   i n t e g e r ( " d o w n l o a d s " ) . d e f a u l t ( 0 ) ,  
     r a t i n g :   n u m e r i c ( " r a t i n g " ,   {   p r e c i s i o n :   3 ,   s c a l e :   2   } ) . d e f a u l t ( " 0 " ) ,  
     r e v i e w C o u n t :   i n t e g e r ( " r e v i e w C o u n t " ) . d e f a u l t ( 0 ) ,  
     c r e a t o r I d :   i n t e g e r ( " c r e a t o r I d " ) . n o t N u l l ( ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   A i M o d e l   =   t y p e o f   a i M o d e l s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   M o d e l   P u r c h a s e s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   m o d e l P u r c h a s e s   =   p g T a b l e ( " m o d e l _ p u r c h a s e s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     m o d e l I d :   i n t e g e r ( " m o d e l I d " ) . n o t N u l l ( ) ,  
     p r i c e P a i d :   i n t e g e r ( " p r i c e P a i d " ) . n o t N u l l ( ) ,  
     p u r c h a s e T y p e :   v a r c h a r ( " p u r c h a s e T y p e " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p u r c h a s e " ) ,  
     s t a t u s :   v a r c h a r ( " p u r c h a s e S t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " a c t i v e " ) ,  
     e x p i r e s A t :   t i m e s t a m p ( " e x p i r e s A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   M o d e l P u r c h a s e   =   t y p e o f   m o d e l P u r c h a s e s . $ i n f e r S e l e c t ;  
  
 / /   “ö Ç “ö Ç “ö Ç   M o d e l   R e v i e w s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   m o d e l R e v i e w s   =   p g T a b l e ( " m o d e l _ r e v i e w s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     m o d e l I d :   i n t e g e r ( " m o d e l I d " ) . n o t N u l l ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     r a t i n g :   i n t e g e r ( " r a t i n g " ) . n o t N u l l ( ) ,  
     r e v i e w :   t e x t ( " r e v i e w " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   P r o m p t   C a c h e   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   p r o m p t C a c h e   =   p g T a b l e ( " p r o m p t _ c a c h e " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     p r o m p t H a s h :   v a r c h a r ( " p r o m p t H a s h " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) . u n i q u e ( ) ,  
     r e s p o n s e :   t e x t ( " r e s p o n s e " ) . n o t N u l l ( ) ,  
     p r o v i d e r :   v a r c h a r ( " p r o v i d e r " ,   {   l e n g t h :   6 4   } ) ,  
     m o d e l :   v a r c h a r ( " m o d e l " ,   {   l e n g t h :   6 4   } ) ,  
     u s a g e :   j s o n ( " u s a g e " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   S c h e d u l e d   J o b   R u n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   s c h e d u l e d J o b R u n s   =   p g T a b l e ( " s c h e d u l e d _ j o b _ r u n s " ,   {  
     i d :   b i g i n t ( " i d " ,   {   m o d e :   " n u m b e r "   } ) . p r i m a r y K e y ( ) ,  
     j o b N a m e :   v a r c h a r ( " j o b N a m e " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     s t a r t e d A t :   t i m e s t a m p ( " s t a r t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     c o m p l e t e d A t :   t i m e s t a m p ( " c o m p l e t e d A t " ) ,  
     d u r a t i o n :   i n t e g e r ( " d u r a t i o n " ) ,  
     i t e m s P r o c e s s e d :   i n t e g e r ( " i t e m s P r o c e s s e d " ) . d e f a u l t ( 0 ) ,  
     r e s u l t :   j s o n ( " r e s u l t " ) ,  
     e r r o r :   t e x t ( " e r r o r " ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   B u d g e t   C o n f i g   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   b u d g e t C o n f i g   =   p g T a b l e ( " b u d g e t _ c o n f i g " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     m o n t h l y L i m i t :   n u m e r i c ( " m o n t h l y L i m i t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   2   } ) . n o t N u l l ( ) ,  
     s p e n t :   n u m e r i c ( " s p e n t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   2   } ) . d e f a u l t ( " 0 . 0 0 " ) ,  
     c u r r e n c y :   v a r c h a r ( " c u r r e n c y " ,   {   l e n g t h :   1 6   } ) . d e f a u l t ( " U S D " ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   S e r v i c e   O r d e r s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   s e r v i c e O r d e r s   =   p g T a b l e ( " s e r v i c e _ o r d e r s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     s e r v i c e T y p e :   v a r c h a r ( " s e r v i c e T y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) . n o t N u l l ( ) ,  
     p r i o r i t y :   i n t e g e r ( " p r i o r i t y " ) . d e f a u l t ( 0 ) ,  
     d e t a i l s :   j s o n ( " d e t a i l s " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   C h a r a c t e r   G e n e r a t i o n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   c h a r a c t e r G e n e r a t i o n s   =   p g T a b l e ( " c h a r a c t e r _ g e n e r a t i o n s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     a r c h e t y p e :   v a r c h a r ( " a r c h e t y p e " ,   {   l e n g t h :   3 2   } ) . n o t N u l l ( ) ,  
     s t y l e :   v a r c h a r ( " s t y l e " ,   {   l e n g t h :   1 2 8   } ) ,  
     c o l o r w a y :   v a r c h a r ( " c o l o r w a y " ,   {   l e n g t h :   6 4   } ) ,  
     m o o d :   v a r c h a r ( " m o o d " ,   {   l e n g t h :   6 4   } ) ,  
     p r o m p t :   t e x t ( " p r o m p t " ) . n o t N u l l ( ) ,  
     n e g a t i v e P r o m p t :   t e x t ( " n e g a t i v e P r o m p t " ) ,  
     p r o v i d e r :   v a r c h a r ( " p r o v i d e r " ,   {   l e n g t h :   6 4   } ) ,  
     p r o v i d e r M o d e l :   v a r c h a r ( " p r o v i d e r M o d e l " ,   {   l e n g t h :   6 4   } ) ,  
     v a r i a n t C o u n t :   i n t e g e r ( " v a r i a n t C o u n t " ) . d e f a u l t ( 1 ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     c o n t e x t :   t e x t ( " c o n t e x t " ) ,  
     b e s t A s s e t I d :   i n t e g e r ( " b e s t A s s e t I d " ) ,  
     s e l e c t e d A s s e t I d :   i n t e g e r ( " s e l e c t e d A s s e t I d " ) ,  
     c o m p l e t e d A t :   t i m e s t a m p ( " c o m p l e t e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   C h a r a c t e r   A s s e t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   c h a r a c t e r A s s e t s   =   p g T a b l e ( " c h a r a c t e r _ a s s e t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     g e n e r a t i o n I d :   i n t e g e r ( " g e n e r a t i o n I d " ) . n o t N u l l ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     i m a g e U r l :   t e x t ( " i m a g e U r l " ) . n o t N u l l ( ) ,  
     p r o m p t :   t e x t ( " p r o m p t " ) ,  
     i s R e c o m m e n d e d :   i n t e g e r ( " i s R e c o m m e n d e d " ) . d e f a u l t ( 0 ) ,  
     i s S e l e c t e d :   i n t e g e r ( " i s S e l e c t e d " ) . d e f a u l t ( 0 ) ,  
     m i n t S t a t u s :   v a r c h a r ( " m i n t S t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " n o t _ m i n t e d " ) ,  
     n f t T o k e n I d :   v a r c h a r ( " n f t T o k e n I d " ,   {   l e n g t h :   6 4   } ) ,  
     m e t a d a t a U r i :   t e x t ( " m e t a d a t a U r i " ) ,  
     m e t a d a t a H a s h :   v a r c h a r ( " m e t a d a t a H a s h " ,   {   l e n g t h :   1 2 8   } ) ,  
     i m a g e H a s h :   v a r c h a r ( " i m a g e H a s h " ,   {   l e n g t h :   1 2 8   } ) ,  
     p r o t o c o l F i t S c o r e :   v a r c h a r ( " p r o t o c o l F i t S c o r e " ,   {   l e n g t h :   8   } ) ,  
     t h u m b n a i l C l a r i t y S c o r e :   v a r c h a r ( " t h u m b n a i l C l a r i t y S c o r e " ,   {   l e n g t h :   8   } ) ,  
     p r e m i u m F e e l S c o r e :   v a r c h a r ( " p r e m i u m F e e l S c o r e " ,   {   l e n g t h :   8   } ) ,  
     s i l h o u e t t e S c o r e :   v a r c h a r ( " s i l h o u e t t e S c o r e " ,   {   l e n g t h :   8   } ) ,  
     t r u s t S y m b o l i s m S c o r e :   v a r c h a r ( " t r u s t S y m b o l i s m S c o r e " ,   {   l e n g t h :   8   } ) ,  
     m i n t R e a d i n e s s S c o r e :   v a r c h a r ( " m i n t R e a d i n e s s S c o r e " ,   {   l e n g t h :   8   } ) ,  
     u i C o m p a t i b i l i t y S c o r e :   v a r c h a r ( " u i C o m p a t i b i l i t y S c o r e " ,   {   l e n g t h :   8   } ) ,  
     t o t a l S c o r e :   v a r c h a r ( " t o t a l S c o r e " ,   {   l e n g t h :   8   } ) ,  
     s c o r e I c o n i t y :   i n t e g e r ( " s c o r e I c o n i t y " ) ,  
     s c o r e T r u s t C l a r i t y :   i n t e g e r ( " s c o r e T r u s t C l a r i t y " ) ,  
     s c o r e P r e m i u m F e e l :   i n t e g e r ( " s c o r e P r e m i u m F e e l " ) ,  
     s c o r e S i l h o u e t t e :   i n t e g e r ( " s c o r e S i l h o u e t t e " ) ,  
     s c o r e U i C o m p a t :   i n t e g e r ( " s c o r e U i C o m p a t " ) ,  
     s c o r e M i n t R e a d y :   i n t e g e r ( " s c o r e M i n t R e a d y " ) ,  
     s c o r e P r o t o c o l A l i g n :   i n t e g e r ( " s c o r e P r o t o c o l A l i g n " ) ,  
     s e l e c t e d A t :   t i m e s t a m p ( " s e l e c t e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   P r o t o c o l   A g e n t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   p r o t o c o l A g e n t s   =   p g T a b l e ( " p r o t o c o l _ a g e n t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     c h a r a c t e r A s s e t I d :   i n t e g e r ( " c h a r a c t e r A s s e t I d " ) . n o t N u l l ( ) ,  
     n a m e :   v a r c h a r ( " n a m e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     a g e n t T y p e :   v a r c h a r ( " a g e n t T y p e " ,   {   l e n g t h :   3 2   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " a c t i v e " ) ,  
     l e v e l :   i n t e g e r ( " l e v e l " ) . d e f a u l t ( 1 ) ,  
     x p :   i n t e g e r ( " x p " ) . d e f a u l t ( 0 ) ,  
     r e p u t a t i o n S c o r e :   i n t e g e r ( " r e p u t a t i o n S c o r e " ) . d e f a u l t ( 0 ) ,  
     q r o n P e n d i n g :   n u m e r i c ( " q r o n P e n d i n g " ,   {   p r e c i s i o n :   2 0 ,   s c a l e :   9   } ) . d e f a u l t ( " 0 . 0 0 0 0 0 0 0 0 0 " ) ,  
     t o t a l V e r i f i c a t i o n s :   i n t e g e r ( " t o t a l V e r i f i c a t i o n s " ) . d e f a u l t ( 0 ) ,  
     s u c c e s s f u l V e r i f i c a t i o n s :   i n t e g e r ( " s u c c e s s f u l V e r i f i c a t i o n s " ) . d e f a u l t ( 0 ) ,  
     t o t a l C l a i m s :   i n t e g e r ( " t o t a l C l a i m s " ) . d e f a u l t ( 0 ) ,  
     f e a t u r e S c o p e s :   j s o n ( " f e a t u r e S c o p e s " ) ,  
     p o l i c y C o n f i g :   j s o n ( " p o l i c y C o n f i g " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   V e r i f i c a t i o n   C l a i m s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   v e r i f i c a t i o n C l a i m s   =   p g T a b l e ( " v e r i f i c a t i o n _ c l a i m s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     a g e n t I d :   i n t e g e r ( " a g e n t I d " ) . n o t N u l l ( ) ,  
     p r o d u c t I d :   i n t e g e r ( " p r o d u c t I d " ) . n o t N u l l ( ) ,  
     a u t h e n t i c a t i o n I d :   i n t e g e r ( " a u t h e n t i c a t i o n I d " ) ,  
     c l a i m T y p e :   v a r c h a r ( " c l a i m T y p e " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     c o n f i d e n c e :   i n t e g e r ( " c o n f i d e n c e " ) . n o t N u l l ( ) ,  
     e v i d e n c e :   t e x t ( " e v i d e n c e " ) ,  
     r e a s o n i n g :   t e x t ( " r e a s o n i n g " ) ,  
     w e i g h t :   v a r c h a r ( " w e i g h t " ,   {   l e n g t h :   1 6   } ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   C o n s e n s u s   R e s u l t s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   c o n s e n s u s R e s u l t s   =   p g T a b l e ( " c o n s e n s u s _ r e s u l t s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     p r o d u c t I d :   i n t e g e r ( " p r o d u c t I d " ) . n o t N u l l ( ) ,  
     a u t h e n t i c a t i o n I d :   i n t e g e r ( " a u t h e n t i c a t i o n I d " ) . n o t N u l l ( ) ,  
     v e r d i c t :   v a r c h a r ( " v e r d i c t " ,   {   l e n g t h :   5 0   } ) . n o t N u l l ( ) ,  
     c o n f i d e n c e :   i n t e g e r ( " c o n f i d e n c e " ) . n o t N u l l ( ) ,  
     p a r t i c i p a n t C o u n t :   i n t e g e r ( " p a r t i c i p a n t C o u n t " ) . d e f a u l t ( 0 ) ,  
     f i n a l i z e d A t :   t i m e s t a m p ( " f i n a l i z e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   Q R O N   R e w a r d   L e d g e r   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   q r o n R e w a r d L e d g e r   =   p g T a b l e ( " q r o n _ r e w a r d _ l e d g e r " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     a g e n t I d :   i n t e g e r ( " a g e n t I d " ) . n o t N u l l ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   2 0 ,   s c a l e :   9   } ) . n o t N u l l ( ) ,  
     r e a s o n :   v a r c h a r ( " r e a s o n " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     r e f e r e n c e T y p e :   v a r c h a r ( " r e f e r e n c e T y p e " ,   {   l e n g t h :   3 2   } ) ,  
     r e f e r e n c e I d :   i n t e g e r ( " r e f e r e n c e I d " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   S t a k i n g   P o s i t i o n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   s t a k i n g P o s i t i o n s   =   p g T a b l e ( " s t a k i n g _ p o s i t i o n s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     a g e n t I d :   i n t e g e r ( " a g e n t I d " ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   2 0 ,   s c a l e :   9   } ) . n o t N u l l ( ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " a c t i v e " ) ,  
     m u l t i p l i e r :   n u m e r i c ( " m u l t i p l i e r " ,   {   p r e c i s i o n :   5 ,   s c a l e :   2   } ) . d e f a u l t ( " 1 . 0 0 " ) ,  
     a p y :   n u m e r i c ( " a p y " ,   {   p r e c i s i o n :   5 ,   s c a l e :   2   } ) . d e f a u l t ( " 5 . 0 0 " ) ,  
     s t a k e d A t :   t i m e s t a m p ( " s t a k e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     r e l e a s e A t :   t i m e s t a m p ( " r e l e a s e A t " ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   C h e c k p o i n t   B a t c h e s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   c h e c k p o i n t B a t c h e s   =   p g T a b l e ( " c h e c k p o i n t _ b a t c h e s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     b a t c h H a s h :   v a r c h a r ( " b a t c h H a s h " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) ,  
     b l o c k c h a i n T x H a s h :   v a r c h a r ( " b l o c k c h a i n T x H a s h " ,   {   l e n g t h :   1 2 8   } ) ,  
     c l a i m C o u n t :   i n t e g e r ( " c l a i m C o u n t " ) . d e f a u l t ( 0 ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     f i n a l i z e d A t :   t i m e s t a m p ( " f i n a l i z e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   M i s s i o n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   m i s s i o n s   =   p g T a b l e ( " m i s s i o n s " ,   {  
     i d :   v a r c h a r ( " i d " ,   {   l e n g t h :   6 4   } ) . p r i m a r y K e y ( ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     t i t l e :   v a r c h a r ( " t i t l e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     d e s c r i p t i o n :   t e x t ( " d e s c r i p t i o n " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) . n o t N u l l ( ) ,  
     p r i o r i t y :   i n t e g e r ( " p r i o r i t y " ) . d e f a u l t ( 0 ) . n o t N u l l ( ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   M i s s i o n   T a s k s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   m i s s i o n T a s k s   =   p g T a b l e ( " m i s s i o n _ t a s k s " ,   {  
     i d :   v a r c h a r ( " i d " ,   {   l e n g t h :   6 4   } ) . p r i m a r y K e y ( ) ,  
     m i s s i o n I d :   v a r c h a r ( " m i s s i o n I d " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     k i n d :   v a r c h a r ( " k i n d " ,   {   l e n g t h :   1 2 8   } ) . n o t N u l l ( ) ,  
     t i t l e :   v a r c h a r ( " t i t l e " ,   {   l e n g t h :   2 5 6   } ) . n o t N u l l ( ) ,  
     d e s c r i p t i o n :   t e x t ( " d e s c r i p t i o n " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) . n o t N u l l ( ) ,  
     p r i o r i t y :   i n t e g e r ( " p r i o r i t y " ) . d e f a u l t ( 0 ) . n o t N u l l ( ) ,  
     o r d e r :   i n t e g e r ( " o r d e r " ) . d e f a u l t ( 0 ) . n o t N u l l ( ) ,  
     p a y l o a d :   j s o n ( " p a y l o a d " ) ,  
     r e s u l t :   j s o n ( " r e s u l t " ) ,  
     e r r o r :   t e x t ( " e r r o r " ) ,  
     s c h e d u l e d A t :   t i m e s t a m p ( " s c h e d u l e d A t " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   P l a t f o r m   F e e s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   p l a t f o r m F e e s   =   p g T a b l e ( " p l a t f o r m _ f e e s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   8   } ) . n o t N u l l ( ) ,  
     c u r r e n c y :   v a r c h a r ( " c u r r e n c y " ,   {   l e n g t h :   1 6   } ) . d e f a u l t ( " U S D " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   T r a n s a c t i o n s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   t r a n s a c t i o n s   =   p g T a b l e ( " t r a n s a c t i o n s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     u s e r I d :   i n t e g e r ( " u s e r I d " ) . n o t N u l l ( ) ,  
     t y p e :   v a r c h a r ( " t y p e " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) ,  
     a m o u n t :   n u m e r i c ( " a m o u n t " ,   {   p r e c i s i o n :   1 8 ,   s c a l e :   8   } ) . n o t N u l l ( ) ,  
     c u r r e n c y :   v a r c h a r ( " c u r r e n c y " ,   {   l e n g t h :   1 6   } ) . d e f a u l t ( " U S D " ) ,  
     s t a t u s :   v a r c h a r ( " s t a t u s " ,   {   l e n g t h :   5 0   } ) . d e f a u l t ( " p e n d i n g " ) ,  
     m e t a d a t a :   j s o n ( " m e t a d a t a " ) ,  
     c r e a t e d A t :   t i m e s t a m p ( " c r e a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 / /   “ö Ç “ö Ç “ö Ç   B a y e s i a n   P r i o r s   “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç “ö Ç  
 e x p o r t   c o n s t   b a y e s i a n P r i o r s   =   p g T a b l e ( " b a y e s i a n _ p r i o r s " ,   {  
     i d :   s e r i a l ( " i d " ) . p r i m a r y K e y ( ) ,  
     s e g m e n t :   v a r c h a r ( " s e g m e n t " ,   {   l e n g t h :   6 4   } ) . n o t N u l l ( ) . u n i q u e ( ) ,  
     p r i o r A l p h a :   n u m e r i c ( " p r i o r A l p h a " ,   {   p r e c i s i o n :   1 0 ,   s c a l e :   4   } ) . d e f a u l t ( " 2 . 0 0 0 0 " ) ,   / /   S u c c e s s e s  
     p r i o r B e t a :   n u m e r i c ( " p r i o r B e t a " ,   {   p r e c i s i o n :   1 0 ,   s c a l e :   4   } ) . d e f a u l t ( " 1 8 . 0 0 0 0 " ) ,   / /   F a i l u r e s   ( B a s e   1 0 %   r a t e )  
     c u r r e n t M e a n :   n u m e r i c ( " c u r r e n t M e a n " ,   {   p r e c i s i o n :   5 ,   s c a l e :   4   } ) . d e f a u l t ( " 0 . 1 0 0 0 " ) ,  
     o b s e r v a t i o n s C o u n t :   i n t e g e r ( " o b s e r v a t i o n s C o u n t " ) . d e f a u l t ( 0 ) ,  
     u p d a t e d A t :   t i m e s t a m p ( " u p d a t e d A t " ) . d e f a u l t N o w ( ) . n o t N u l l ( ) ,  
 } ) ;  
  
 e x p o r t   t y p e   B a y e s i a n P r i o r   =   t y p e o f   b a y e s i a n P r i o r s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t B a y e s i a n P r i o r   =   t y p e o f   b a y e s i a n P r i o r s . $ i n f e r I n s e r t ;  
  
 e x p o r t   t y p e   M i s s i o n   =   t y p e o f   m i s s i o n s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   M i s s i o n T a s k   =   t y p e o f   m i s s i o n T a s k s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   C h a r a c t e r G e n e r a t i o n   =   t y p e o f   c h a r a c t e r G e n e r a t i o n s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t C h a r a c t e r G e n e r a t i o n   =   t y p e o f   c h a r a c t e r G e n e r a t i o n s . $ i n f e r I n s e r t ;  
 e x p o r t   t y p e   C h a r a c t e r A s s e t   =   t y p e o f   c h a r a c t e r A s s e t s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t C h a r a c t e r A s s e t   =   t y p e o f   c h a r a c t e r A s s e t s . $ i n f e r I n s e r t ;  
 e x p o r t   t y p e   P r o t o c o l A g e n t   =   t y p e o f   p r o t o c o l A g e n t s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t P r o t o c o l A g e n t   =   t y p e o f   p r o t o c o l A g e n t s . $ i n f e r I n s e r t ;  
 e x p o r t   t y p e   S t a k i n g P o s i t i o n   =   t y p e o f   s t a k i n g P o s i t i o n s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t S t a k i n g P o s i t i o n   =   t y p e o f   s t a k i n g P o s i t i o n s . $ i n f e r I n s e r t ;  
 e x p o r t   t y p e   P l a t f o r m F e e   =   t y p e o f   p l a t f o r m F e e s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t P l a t f o r m F e e   =   t y p e o f   p l a t f o r m F e e s . $ i n f e r I n s e r t ;  
 e x p o r t   t y p e   T r a n s a c t i o n   =   t y p e o f   t r a n s a c t i o n s . $ i n f e r S e l e c t ;  
 e x p o r t   t y p e   I n s e r t T r a n s a c t i o n   =   t y p e o f   t r a n s a c t i o n s . $ i n f e r I n s e r t ;  
 