# Impossible Artifacts: QRON Demo Repository

## 1. The "Hidden Patriot" (USPS Flagship Concept)
**Visual Goal:** A moody, high-end oil painting where the QR code is "hidden" in the play of light and shadow.
*   **Prompt:** `"Hyper-realistic oil painting of a vintage blue US Post Box standing on a cobblestone street at midnight. The surrounding deep shadows and sharp moonlight reflections on the metal are precisely structured to form a scannable QR matrix. Masterpiece, 8k, philatelic aesthetic, dramatic chiaroscuro."`
*   **Negative Prompt:** `"blurry, low contrast, distorted post box, text, labels, messy, bright daylight, flat lighting"`
*   **Technical Parameters:**
    *   `qr_weight`: 1.45 (Stronger weighting to ensure shadow-based scanning)
    *   `start_step`: 0.25 (Early injection to bake the QR into the texture)
    *   `ecc`: 'H' (30% recovery)

## 2. The "Kinetic Stamp" (Perspective Shift)
**Visual Goal:** An architectural drawing where the QR only "assembles" when viewed at a specific angle.
*   **Prompt:** `"Blueprint-style architectural drawing of the James A. Farley Post Office Building in NYC. The vanishing point and perspective lines converge to form a scannable QR code. Technical drawing aesthetic, blueprint blue and white, sharp lines."`
*   **Technical Parameters:**
    *   `qr_weight`: 1.3
    *   `start_step`: 0.4 (Later injection to maintain the thin technical lines)

## 3. The "Generative Rarity" (1-of-1 Collection)
**Visual Goal:** A series where the subject is the same, but the "Art Style" changes per scan.
*   **Prompt Template:** `"A bald eagle in flight, [STYLE] background, high contrast silhouette for QR scannability."`
*   **Styles to Rotate:** `['Neon Vaporwave', 'Vintage Woodblock Print', 'Abstract Expressionist Gold Leaf', 'Cyberpunk Glitch']`
