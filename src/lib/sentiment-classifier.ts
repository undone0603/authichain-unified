import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'objection';
  objectionType: null | 'budget' | 'timeline' | 'competitor' | 'decision_maker' | 'other';
  objectionDetails: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Classify an inbound email reply using GPT-4 via the ai SDK.
 * Determines sentiment and identifies objections with high confidence.
 */
export async function classifyReplyEmail(
  emailBody: string,
  emailSubject: string,
): Promise<SentimentResult> {
  try {
    const prompt = `You are an expert sales analyst. Classify this customer reply to a business proposal.

Email Subject: ${emailSubject}

Email Body:
${emailBody}

Analyze the sentiment and identify any objections. Return a JSON object with:
- "sentiment": one of "positive" (ready to move forward), "neutral" (info-seeking or non-committal), "negative" (explicit rejection), or "objection" (concern raised with specific blocker)
- "objectionType": if sentiment is "objection", one of: "budget", "timeline", "competitor", "decision_maker", or "other"; otherwise null
- "objectionDetails": if an objection exists, a brief summary of the specific concern; otherwise null
- "confidence": a number from 0.0 to 1.0 indicating how confident you are in this classification
- "reasoning": a brief explanation of your classification (1-2 sentences)

Return ONLY a valid JSON object, no markdown or extra text.`;

    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      prompt,
      temperature: 0.3, // Low temperature for consistent classification
      maxOutputTokens: 500,
    });

    const jsonText = text.trim();

    // Parse JSON response
    const result = JSON.parse(jsonText);

    // Validate response structure
    if (!['positive', 'neutral', 'negative', 'objection'].includes(result.sentiment)) {
      throw new Error(`Invalid sentiment: ${result.sentiment}`);
    }

    if (result.sentiment === 'objection' && result.objectionType) {
      const validTypes = ['budget', 'timeline', 'competitor', 'decision_maker', 'other'];
      if (!validTypes.includes(result.objectionType)) {
        throw new Error(`Invalid objectionType: ${result.objectionType}`);
      }
    }

    return {
      sentiment: result.sentiment,
      objectionType: result.objectionType || null,
      objectionDetails: result.objectionDetails || null,
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
      reasoning: result.reasoning || 'Classification completed',
    };
  } catch (error) {
    console.error('Sentiment classification error:', error);

    // Fallback: return neutral classification with low confidence
    return {
      sentiment: 'neutral',
      objectionType: null,
      objectionDetails: null,
      confidence: 0.3,
      reasoning: `Classification failed, defaulting to neutral: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Lightweight helper to detect if an email is likely a reply (vs bounce/OOO).
 * Returns true if email should be processed as a legitimate reply.
 */
export function isProbablyLegitimateReply(subject: string, body: string): boolean {
  const subject_lower = subject.toLowerCase();
  const body_lower = body.toLowerCase();

  // Filter out auto-replies
  const autoReplyPatterns = [
    /out of office/i,
    /auto.?reply/i,
    /automatic response/i,
    /away from office/i,
    /i am currently out/i,
  ];

  if (autoReplyPatterns.some(pattern => subject_lower.match(pattern) || body_lower.match(pattern))) {
    return false;
  }

  // Filter out bounces
  const bouncePatterns = [/delivery failed/i, /undeliverable/i, /mail delivery failed/i, /bounce/i];

  if (bouncePatterns.some(pattern => subject_lower.match(pattern) || body_lower.match(pattern))) {
    return false;
  }

  // Filter out empty bodies
  if (!body.trim() || body.trim().length < 5) {
    return false;
  }

  return true;
}
