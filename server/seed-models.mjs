import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiModels } from "../drizzle/schema.js";

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const demoModels = [
  {
    name: "PhotoRealistic AI - Pro",
    description: "State-of-the-art image generation model trained on 100M+ professional photos. Creates photorealistic images from text descriptions with incredible detail and accuracy.",
    category: "image-generation",
    price: 19900, // $199.00
    modelType: "purchase",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
    modelUrl: "https://api.authichain.ai/models/photorealistic-pro",
    version: "2.1.0",
    downloads: 1247,
    rating: 480, // 4.8 stars
    reviewCount: 89,
    status: "active",
    tags: JSON.stringify(["image-generation", "photorealistic", "professional", "high-quality"]),
    features: JSON.stringify([
      "4K resolution output",
      "Multiple style presets",
      "Batch processing",
      "API access included",
      "Commercial license"
    ]),
    requirements: JSON.stringify({
      gpu: "NVIDIA RTX 3060 or better",
      ram: "16GB minimum",
      storage: "10GB"
    })
  },
  {
    name: "GPT-Style Text Generator",
    description: "Advanced natural language processing model for content creation, copywriting, and text generation. Perfect for marketers, writers, and content creators.",
    category: "nlp",
    price: 14900, // $149.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1676277791608-ac5c6039a1f1?w=800",
    modelUrl: "https://api.authichain.ai/models/gpt-text-gen",
    version: "3.5.2",
    downloads: 2891,
    rating: 470, // 4.7 stars
    reviewCount: 203,
    status: "active",
    tags: JSON.stringify(["nlp", "text-generation", "content-creation", "copywriting"]),
    features: JSON.stringify([
      "50+ writing styles",
      "Multi-language support",
      "SEO optimization",
      "Plagiarism-free content",
      "API integration"
    ]),
    requirements: JSON.stringify({
      cpu: "4 cores minimum",
      ram: "8GB minimum",
      storage: "5GB"
    })
  },
  {
    name: "Voice Clone Studio",
    description: "Professional voice synthesis and cloning technology. Create realistic voice overs, audiobooks, and voice assistants with your own custom voice.",
    category: "voice",
    price: 24900, // $249.00
    modelType: "purchase",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=800",
    modelUrl: "https://api.authichain.ai/models/voice-clone",
    version: "1.8.0",
    downloads: 567,
    rating: 490, // 4.9 stars
    reviewCount: 45,
    status: "active",
    tags: JSON.stringify(["voice", "audio", "synthesis", "cloning", "tts"]),
    features: JSON.stringify([
      "Voice cloning from 30s sample",
      "40+ languages",
      "Emotion control",
      "Real-time synthesis",
      "Commercial rights"
    ]),
    requirements: JSON.stringify({
      cpu: "8 cores recommended",
      ram: "16GB minimum",
      storage: "8GB"
    })
  },
  {
    name: "Market Predictor AI",
    description: "Advanced machine learning model for market analysis and prediction. Trained on 10 years of financial data to forecast trends and identify opportunities.",
    category: "analytics",
    price: 49900, // $499.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
    modelUrl: "https://api.authichain.ai/models/market-predictor",
    version: "4.2.1",
    downloads: 892,
    rating: 460, // 4.6 stars
    reviewCount: 127,
    status: "active",
    tags: JSON.stringify(["analytics", "finance", "prediction", "trading", "ml"]),
    features: JSON.stringify([
      "Real-time market analysis",
      "Risk assessment",
      "Portfolio optimization",
      "Backtesting tools",
      "API + dashboard"
    ]),
    requirements: JSON.stringify({
      cpu: "6 cores minimum",
      ram: "32GB recommended",
      storage: "15GB"
    })
  },
  {
    name: "Quick Sketch AI",
    description: "Fast and affordable sketch-to-image model. Perfect for rapid prototyping, concept art, and creative exploration. Great for beginners!",
    category: "image-generation",
    price: 2900, // $29.00
    modelType: "rental",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
    modelUrl: "https://api.authichain.ai/models/quick-sketch",
    version: "1.2.0",
    downloads: 3421,
    rating: 440, // 4.4 stars
    reviewCount: 312,
    status: "active",
    tags: JSON.stringify(["image-generation", "sketch", "concept-art", "beginner-friendly"]),
    features: JSON.stringify([
      "Fast generation (5-10s)",
      "Sketch-to-image",
      "Style transfer",
      "Batch mode",
      "7-day access"
    ]),
    requirements: JSON.stringify({
      gpu: "GTX 1060 or better",
      ram: "8GB minimum",
      storage: "3GB"
    })
  },
  {
    name: "Sentiment Analyzer Pro",
    description: "Enterprise-grade sentiment analysis for customer feedback, social media monitoring, and brand reputation management. Supports 25+ languages.",
    category: "nlp",
    price: 29900, // $299.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
    modelUrl: "https://api.authichain.ai/models/sentiment-pro",
    version: "2.5.0",
    downloads: 1456,
    rating: 475, // 4.75 stars
    reviewCount: 178,
    status: "active",
    tags: JSON.stringify(["nlp", "sentiment", "analytics", "enterprise", "monitoring"]),
    features: JSON.stringify([
      "Real-time sentiment tracking",
      "Multi-language support",
      "Emotion detection",
      "Trend analysis",
      "White-label API"
    ]),
    requirements: JSON.stringify({
      cpu: "4 cores minimum",
      ram: "16GB minimum",
      storage: "6GB"
    })
  },
  {
    name: "3D Asset Generator",
    description: "Revolutionary AI model that generates 3D models from text or images. Perfect for game developers, architects, and 3D artists.",
    category: "image-generation",
    price: 34900, // $349.00
    modelType: "purchase",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800",
    modelUrl: "https://api.authichain.ai/models/3d-asset-gen",
    version: "1.5.0",
    downloads: 734,
    rating: 485, // 4.85 stars
    reviewCount: 67,
    status: "active",
    tags: JSON.stringify(["3d", "modeling", "game-dev", "architecture", "design"]),
    features: JSON.stringify([
      "Text-to-3D generation",
      "Multiple export formats",
      "Texture generation",
      "UV mapping",
      "Commercial license"
    ]),
    requirements: JSON.stringify({
      gpu: "RTX 3070 or better",
      ram: "24GB minimum",
      storage: "12GB"
    })
  },
  {
    name: "Code Assistant AI",
    description: "Intelligent code completion and generation model. Supports 20+ programming languages. Boost your productivity by 10x with AI-powered coding assistance.",
    category: "nlp",
    price: 7900, // $79.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
    modelUrl: "https://api.authichain.ai/models/code-assistant",
    version: "2.8.3",
    downloads: 5234,
    rating: 495, // 4.95 stars
    reviewCount: 421,
    status: "active",
    tags: JSON.stringify(["coding", "development", "productivity", "automation", "nlp"]),
    features: JSON.stringify([
      "20+ languages",
      "Context-aware suggestions",
      "Bug detection",
      "Code refactoring",
      "IDE integration"
    ]),
    requirements: JSON.stringify({
      cpu: "2 cores minimum",
      ram: "4GB minimum",
      storage: "2GB"
    })
  },
  {
    name: "Music Composer AI",
    description: "Create original music compositions in any genre. From background music to full songs. Perfect for content creators, game developers, and musicians.",
    category: "audio",
    price: 19900, // $199.00
    modelType: "purchase",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800",
    modelUrl: "https://api.authichain.ai/models/music-composer",
    version: "3.1.0",
    downloads: 1823,
    rating: 465, // 4.65 stars
    reviewCount: 156,
    status: "active",
    tags: JSON.stringify(["music", "audio", "composition", "creative", "royalty-free"]),
    features: JSON.stringify([
      "15+ music genres",
      "Customizable tempo/key",
      "Stem separation",
      "MIDI export",
      "Royalty-free license"
    ]),
    requirements: JSON.stringify({
      cpu: "6 cores recommended",
      ram: "12GB minimum",
      storage: "8GB"
    })
  },
  {
    name: "Video Upscaler Pro",
    description: "AI-powered video enhancement and upscaling. Transform low-resolution videos to 4K quality with advanced neural networks. Hollywood-grade results.",
    category: "video",
    price: 39900, // $399.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800",
    modelUrl: "https://api.authichain.ai/models/video-upscaler",
    version: "2.3.0",
    downloads: 923,
    rating: 488, // 4.88 stars
    reviewCount: 94,
    status: "active",
    tags: JSON.stringify(["video", "upscaling", "enhancement", "4k", "professional"]),
    features: JSON.stringify([
      "Up to 4K upscaling",
      "Noise reduction",
      "Frame interpolation",
      "Batch processing",
      "GPU acceleration"
    ]),
    requirements: JSON.stringify({
      gpu: "RTX 3080 or better",
      ram: "32GB minimum",
      storage: "20GB"
    })
  },
  {
    name: "ChatBot Builder AI",
    description: "No-code AI chatbot creation platform. Build intelligent customer service bots, sales assistants, and support agents in minutes. Includes training tools.",
    category: "nlp",
    price: 9900, // $99.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800",
    modelUrl: "https://api.authichain.ai/models/chatbot-builder",
    version: "1.9.5",
    downloads: 2567,
    rating: 455, // 4.55 stars
    reviewCount: 234,
    status: "active",
    tags: JSON.stringify(["chatbot", "customer-service", "automation", "nlp", "no-code"]),
    features: JSON.stringify([
      "Visual bot builder",
      "Multi-channel deployment",
      "Analytics dashboard",
      "Custom training",
      "Unlimited conversations"
    ]),
    requirements: JSON.stringify({
      cpu: "2 cores minimum",
      ram: "4GB minimum",
      storage: "3GB"
    })
  },
  {
    name: "Document AI Scanner",
    description: "Extract structured data from documents, invoices, receipts, and forms. OCR + intelligent parsing. Process thousands of documents automatically.",
    category: "analytics",
    price: 24900, // $249.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1568667256549-094345857637?w=800",
    modelUrl: "https://api.authichain.ai/models/document-scanner",
    version: "3.4.0",
    downloads: 1678,
    rating: 478, // 4.78 stars
    reviewCount: 145,
    status: "active",
    tags: JSON.stringify(["ocr", "document", "automation", "data-extraction", "enterprise"]),
    features: JSON.stringify([
      "99%+ accuracy OCR",
      "50+ document types",
      "Auto-categorization",
      "Batch processing",
      "API + webhook support"
    ]),
    requirements: JSON.stringify({
      cpu: "4 cores minimum",
      ram: "8GB minimum",
      storage: "5GB"
    })
  },
  {
    name: "Style Transfer Studio",
    description: "Transform photos and videos with artistic styles. Apply famous painting styles, create unique filters, and generate stunning visual effects.",
    category: "image-generation",
    price: 4900, // $49.00
    modelType: "rental",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800",
    modelUrl: "https://api.authichain.ai/models/style-transfer",
    version: "2.0.1",
    downloads: 4123,
    rating: 450, // 4.5 stars
    reviewCount: 389,
    status: "active",
    tags: JSON.stringify(["style-transfer", "art", "filters", "creative", "photo-editing"]),
    features: JSON.stringify([
      "100+ art styles",
      "Video style transfer",
      "Custom style training",
      "Batch processing",
      "7-day unlimited access"
    ]),
    requirements: JSON.stringify({
      gpu: "GTX 1660 or better",
      ram: "8GB minimum",
      storage: "4GB"
    })
  },
  {
    name: "Translation AI Pro",
    description: "Neural machine translation for 100+ languages. Context-aware, industry-specific terminology, and real-time translation. Enterprise-grade accuracy.",
    category: "nlp",
    price: 17900, // $179.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=800",
    modelUrl: "https://api.authichain.ai/models/translation-pro",
    version: "4.1.2",
    downloads: 2134,
    rating: 482, // 4.82 stars
    reviewCount: 198,
    status: "active",
    tags: JSON.stringify(["translation", "multilingual", "localization", "nlp", "enterprise"]),
    features: JSON.stringify([
      "100+ languages",
      "Industry glossaries",
      "Document translation",
      "Real-time API",
      "Quality scoring"
    ]),
    requirements: JSON.stringify({
      cpu: "4 cores minimum",
      ram: "12GB minimum",
      storage: "7GB"
    })
  },
  {
    name: "Face Animation AI",
    description: "Animate faces from photos or create deepfake videos. Perfect for avatars, virtual presenters, and content creation. Ethical use guidelines included.",
    category: "video",
    price: 27900, // $279.00
    modelType: "purchase",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800",
    modelUrl: "https://api.authichain.ai/models/face-animation",
    version: "1.7.0",
    downloads: 1245,
    rating: 472, // 4.72 stars
    reviewCount: 112,
    status: "active",
    tags: JSON.stringify(["face", "animation", "deepfake", "avatar", "video"]),
    features: JSON.stringify([
      "Photo-to-video animation",
      "Lip sync generation",
      "Expression control",
      "HD output",
      "Ethical use license"
    ]),
    requirements: JSON.stringify({
      gpu: "RTX 3060 or better",
      ram: "16GB minimum",
      storage: "10GB"
    })
  },
  {
    name: "SEO Content Optimizer",
    description: "AI-powered SEO analysis and content optimization. Improve rankings, generate meta tags, and create SEO-friendly content automatically.",
    category: "analytics",
    price: 12900, // $129.00
    modelType: "subscription",
    ownerId: 1,
    imageUrl: "https://images.unsplash.com/photo-1432888622747-4eb9a8f2c293?w=800",
    modelUrl: "https://api.authichain.ai/models/seo-optimizer",
    version: "2.6.0",
    downloads: 3456,
    rating: 468, // 4.68 stars
    reviewCount: 287,
    status: "active",
    tags: JSON.stringify(["seo", "content", "optimization", "marketing", "analytics"]),
    features: JSON.stringify([
      "Keyword research",
      "Content scoring",
      "Competitor analysis",
      "Meta tag generation",
      "Rank tracking"
    ]),
    requirements: JSON.stringify({
      cpu: "2 cores minimum",
      ram: "4GB minimum",
      storage: "2GB"
    })
  }
];

async function seedModels() {
  console.log("🌱 Seeding demo AI models...");
  
  try {
    for (const model of demoModels) {
      await db.insert(aiModels).values(model);
      console.log(`✅ Added: ${model.name}`);
    }
    
    console.log(`\n🎉 Successfully seeded ${demoModels.length} demo AI models!`);
    console.log("\nCategories:");
    console.log("- Image Generation: 5 models");
    console.log("- NLP/Text: 5 models");
    console.log("- Voice/Audio: 2 models");
    console.log("- Video: 2 models");
    console.log("- Analytics: 3 models");
    console.log("\nPrice range: $29 - $499");
    console.log("Total potential revenue: $3,878 (if all sold once)");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding models:", error);
    process.exit(1);
  }
}

seedModels();
