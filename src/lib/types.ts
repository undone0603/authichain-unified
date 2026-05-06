// Define QRONMode enum or type
export type QRONMode =
  | 'static'
  | 'stereographic'
  | 'kinetic'
  | 'holographic'
  | 'memory'
  | 'echo'
  | 'temporal'
  | 'reactive'
  | 'layered'
  | 'dimensional'
  | 'living';

// Define GeneratedQRON interface
export interface GeneratedQRON {
  id: string;
  imageUrl: string;
  destinationUrl?: string;
  qrDataUrl?: string;
  targetUrl?: string;
  prompt?: string;
  mode?: string;
  createdAt?: string;
  registration_id?: string | null;
}

export interface ScanResult {
  id: string;
  scannable: boolean;
  decoded: string | null;
  confidence: number;
  registration_id: string;
}

// Define QRONEntry type
export type QRONEntry = {
  id: string;
  user_id: string;
  mode: QRONMode;
  qr_content: string;
  prompt: string;
  image_url: string; // e.g., /media/gallery-chromatic-portal-1080.svg
  target_url: string;
  is_demo: boolean;
  scan_count: number;
  download_count?: number; // Added from database
  folder_id?: string | null; // Added from database
  qron_tags?: { tag_id: string }[]; // Added for join
  created_at: string;
  updated_at?: string; // Added from database
  metadata?: {
    blockchain?: 'polygon' | 'base' | 'ethereum';
    tx_hash?: string;
    anchor_id?: string;
    anchored_at?: string;
  } | any;
  story_enabled?: boolean;
  story_tier?: string;
  story_unlocked_at?: string;
};

// Define FalaiPreset type
export type FalaiPreset = {
  id: string;
  name: string;
  description: string;
  is_premium: boolean;
  tier: 'free' | 'pro' | 'enterprise';
};

// Define QRONModeConfig interface
export interface QRONModeConfig {
  id: QRONMode;
  name: string;
  description: string;
  icon: string;
  tier: 'free' | 'pro' | 'enterprise';
  features: string[];
}

export const MODES: QRONModeConfig[] = [
  {
    id: 'static',
    name: 'Static',
    description: 'AI-styled QR code',
    icon: 'sparkles',
    tier: 'free',
    features: ['AI styling', 'High resolution', 'Instant generation'],
  },
  {
    id: 'stereographic',
    name: 'Stereographic',
    description: '3D depth effect',
    icon: 'layers3',
    tier: 'free',
    features: ['3D depth', 'Parallax effect', 'Cross-eye viewable'],
  },
  {
    id: 'kinetic',
    name: 'Kinetic',
    description: 'Animated motion QR',
    icon: 'play',
    tier: 'pro',
    features: ['Video output', 'Smooth animation', 'Loop-ready'],
  },
  {
    id: 'holographic',
    name: 'Holographic',
    description: 'Shimmer & shift',
    icon: 'star',
    tier: 'pro',
    features: ['Color shift', 'Holographic foil', 'Premium look'],
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Mint as NFT',
    icon: 'wallet',
    tier: 'pro',
    features: ['On-chain', 'Own forever', 'Tradeable'],
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Ultrasonic enabled',
    icon: 'radio',
    tier: 'pro',
    features: ['Sound trigger', 'Proximity detect', 'Chirp.io'],
  },
  {
    id: 'temporal',
    name: 'Temporal',
    description: 'Time-based evolution',
    icon: 'clock',
    tier: 'enterprise',
    features: ['Scheduled changes', 'Day/night modes', 'Event triggers'],
  },
  {
    id: 'reactive',
    name: 'Reactive',
    description: 'Environment-aware',
    icon: 'zap',
    tier: 'enterprise',
    features: ['Weather sync', 'Location aware', 'Context adaptive'],
  },
  {
    id: 'layered',
    name: 'Layered',
    description: 'Multi-composition',
    icon: 'layers',
    tier: 'enterprise',
    features: ['Multiple layers', 'Blend modes', 'Complex designs'],
  },
  {
    id: 'dimensional',
    name: 'Dimensional',
    description: 'AR-ready spatial',
    icon: 'box',
    tier: 'enterprise',
    features: ['AR compatible', 'Spatial anchor', '3D placement'],
  },
  {
    id: 'living',
    name: 'Living',
    description: 'Self-evolving AI',
    icon: 'heart',
    tier: 'enterprise',
    features: ['AI evolution', 'Learns & adapts', 'Truly alive'],
  },
];
