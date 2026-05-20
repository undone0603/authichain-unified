# QRON Art Styles Guide

## What is QRON?

QRON (QR + ON-chain) codes are AI-generated artistic QR codes that remain fully scannable while looking like works of art. Each QRON encodes verification data and is anchored to the Polygon blockchain.

## 11 Style Modes

### 1. Cosmic Nebula
Deep space aesthetic with swirling galaxies, nebula clouds, and star fields. The QR pattern emerges from cosmic dust. Best for: tech products, futuristic brands.

### 2. Cyberpunk
Neon-drenched cityscapes with glitch effects, circuit patterns, and holographic overlays. Best for: electronics, gaming, urban brands.

### 3. Watercolor
Soft, flowing watercolor washes with organic bleeding effects. QR modules appear as deliberate brushstrokes. Best for: artisan products, food & beverage, beauty.

### 4. Holographic Mosaic
Iridescent tile patterns with prismatic color shifts. Creates a premium, jewelry-like appearance. Best for: luxury goods, premium packaging.

### 5. Teal Pulse
AuthiChain's signature style — glowing teal energy pulses radiating from QR nodes. Clean, professional, high-tech. Best for: default/branded use.

### 6. Medieval Fantasy
Illuminated manuscript style with gold leaf, ornate borders, and mythical creatures woven into the QR grid. Best for: artisan spirits, heritage brands.

### 7. Anime/Manga
Japanese animation aesthetic with bold lines, speed effects, and character integration. Best for: collectibles, entertainment, youth brands.

### 8. Architectural
Blueprint-style with precise geometric lines, isometric perspectives, and structural elements. Best for: construction, real estate, industrial.

### 9. Echo QR
Layered concentric rings radiating outward from the QR center, creating a sonar/ripple effect. Best for: audio products, communications, wellness.

### 10. Video QR
Animated QRON that cycles through multiple frames while maintaining scannability. Creates a living, breathing QR experience. Best for: digital displays, events.

### 11. Phantom QR
Near-invisible QR that only reveals itself under certain lighting or viewing angles. Uses subtle contrast variations. Best for: security applications, covert marking.

## Technical Parameters

- **Resolution**: 1024×1024px (standard), up to 4096×4096px (enterprise)
- **Error Correction**: Level H (30% redundancy) for art integration
- **Scan Reliability**: >99.2% first-scan success rate
- **Generation Time**: 3-8 seconds via fal.ai illusion-diffusion
- **Cost**: $0.006/generation (platform cost) + markup by tier

## Custom Prompts

Users can provide custom prompts to generate unique QRON art. The system uses:
- Base model: Stable Diffusion XL
- ControlNet: QR Code conditioning (scale 1.0-1.5)
- LoRA: `qronart` trigger word for brand consistency

## Best Practices

1. Keep encoded data under 150 characters for optimal art space
2. Use high contrast styles for small print sizes
3. Test scan at actual viewing distance before production
4. Video QR requires minimum 3-second loop for reliable scan
5. Phantom QR should only be used where alternative verification exists
