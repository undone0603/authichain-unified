/**
 * AuthiChain Vision Service — ProductDNA™ Engine
 * Uses GPT-4o Vision to analyze product snapshots against 
 * harvest-level visual markers.
 */
import { invokeLLM } from "./_core/llm";

export interface DNAAnalysisResult {
  isMatch: boolean;
  confidence: number;
  markers: string[];
  visualAnomalies: string[];
  recommendation: string;
}

/**
 * Analyzes a product image using real GPT-4o Vision.
 */
export async function analyzeProductVision(imageUrl: string, productType: string): Promise<DNAAnalysisResult> {
  console.log(`🧬 Analyzing ProductDNA for ${productType} via GPT-4o Vision...`);

  try {
    const systemPrompt = `You are the AuthiChain ProductDNA verification engine. 
    Analyze the provided image of a cannabis product (${productType}). 
    Identify visual markers such as trichome density, packaging seal integrity, and color consistency. 
    Compare against known industry standards for high-grade products.
    
    IMPORTANT: Return ONLY a JSON object with this structure:
    { "result": "match" | "mismatch", "confidence": 0-100, "markers": [], "anomalies": [], "recommendation": "" }`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: "Please verify if this product matches the recorded harvest DNA markers." },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
          ] as any
        }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = response.choices[0].message.content as string;
    let analysis;
    
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      console.warn("[Vision] Failed to parse LLM response, using partial extraction...");
      // Simple regex fallback for malformed JSON
      const resultMatch = content.match(/"result":\s*"([^"]+)"/);
      analysis = {
        result: resultMatch ? resultMatch[1] : "mismatch",
        confidence: 50,
        markers: ["Automatic parsing failed"],
        anomalies: ["Unstructured response"],
        recommendation: "Manual review required due to system variance."
      };
    }

    return {
      isMatch: analysis.result === "match",
      confidence: analysis.confidence || 0,
      markers: analysis.markers || [],
      visualAnomalies: analysis.anomalies || [],
      recommendation: analysis.recommendation || "No recommendation provided."
    };

  } catch (error: any) {
    console.error("[Vision] Critical failure:", error.message);
    return {
      isMatch: false,
      confidence: 0,
      markers: [],
      visualAnomalies: ["Vision system offline"],
      recommendation: "System error during analysis. Flag for manual inspection."
    };
  }
}
