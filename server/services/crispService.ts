import Crisp from 'crisp-api';

/**
 * Crisp Communication Service
 * Handles all customer communications: emails, chat, and automated messages
 */

interface CrispConfig {
  identifier: string;
  key: string;
  websiteId: string;
}

let crispClient: any = null;
let isConfigured = false;

/**
 * Initialize Crisp client
 */
function initializeCrisp(): CrispConfig | null {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;

  if (!identifier || !key || !websiteId) {
    console.warn('[Crisp] Credentials not configured - communications will be logged to console');
    return null;
  }

  if (!isConfigured) {
    crispClient = new Crisp();
    crispClient.authenticateTier('plugin', identifier, key);
    isConfigured = true;
    console.log('[Crisp] Client initialized successfully');
  }

  return { identifier, key, websiteId };
}

/**
 * Send certificate email via Crisp
 */
export async function sendCertificateEmail(params: {
  to: string;
  customerName?: string;
  certificateNumber: string;
  productName: string;
  tier: string;
  isAuthentic: boolean;
  confidenceScore: number;
  certificateUrl: string;
  nftTokenId: string;
}): Promise<boolean> {
  const config = initializeCrisp();

  const {
    to,
    customerName,
    certificateNumber,
    productName,
    tier,
    isAuthentic,
    confidenceScore,
    certificateUrl,
    nftTokenId,
  } = params;

  // If Crisp is not configured, log to console
  if (!config || !crispClient) {
    console.log('[Crisp] Would send certificate email:');
    console.log(`To: ${to}`);
    console.log(`Certificate: ${certificateNumber}`);
    console.log(`Product: ${productName}`);
    console.log(`URL: ${certificateUrl}`);
    console.log('---');
    return true;
  }

  try {
    // Send email via Crisp
    await crispClient.website.sendMessageInConversation(
      config.websiteId,
      to, // session_id (email)
      {
        type: 'text',
        from: 'operator',
        origin: 'chat',
        content: generateCertificateMessage({
          customerName: customerName || 'Valued Customer',
          certificateNumber,
          productName,
          tier,
          isAuthentic,
          confidenceScore,
          certificateUrl,
          nftTokenId,
        }),
      }
    );

    console.log(`[Crisp] Certificate message sent successfully to ${to}`);
    return true;

  } catch (error: any) {
    console.error('[Crisp] Failed to send certificate message:', error);
    return false;
  }
}

/**
 * Generate certificate message content
 */
function generateCertificateMessage(params: {
  customerName: string;
  certificateNumber: string;
  productName: string;
  tier: string;
  isAuthentic: boolean;
  confidenceScore: number;
  certificateUrl: string;
  nftTokenId: string;
}): string {
  const {
    customerName,
    certificateNumber,
    productName,
    tier,
    isAuthentic,
    confidenceScore,
    certificateUrl,
    nftTokenId,
  } = params;

  const statusEmoji = isAuthentic ? '✅' : '❌';
  const statusText = isAuthentic ? 'AUTHENTIC' : 'COUNTERFEIT';

  return `
🎉 Hello ${customerName}!

Your ${tier.toUpperCase()} authentication certificate is ready!

📋 Certificate Details:
• Product: ${productName}
• Certificate #: ${certificateNumber}
• Result: ${statusEmoji} ${statusText}
• Confidence: ${confidenceScore}%
• NFT Token: ${nftTokenId}

🔗 View Certificate: ${certificateUrl}

Your certificate is permanently stored on the blockchain and can be verified at any time.

Thank you for choosing AuthiChain AI! 🚀
  `.trim();
}

/**
 * Send message to customer via Crisp
 */
export async function sendCrispMessage(params: {
  email: string;
  message: string;
}): Promise<boolean> {
  const config = initializeCrisp();

  if (!config || !crispClient) {
    console.log('[Crisp] Would send message:', params.message);
    return true;
  }

  try {
    await crispClient.website.sendMessageInConversation(
      config.websiteId,
      params.email,
      {
        type: 'text',
        from: 'operator',
        origin: 'chat',
        content: params.message,
      }
    );

    console.log(`[Crisp] Message sent to ${params.email}`);
    return true;

  } catch (error) {
    console.error('[Crisp] Failed to send message:', error);
    return false;
  }
}

/**
 * Create or update conversation profile
 */
export async function updateCrispProfile(params: {
  email: string;
  name?: string;
  data?: Record<string, any>;
}): Promise<boolean> {
  const config = initializeCrisp();

  if (!config || !crispClient) {
    console.log('[Crisp] Would update profile for:', params.email);
    return true;
  }

  try {
    // Update people profile
    if (params.name) {
      await crispClient.website.updatePeopleProfile(
        config.websiteId,
        params.email,
        {
          person: {
            nickname: params.name,
          },
        }
      );
    }

    // Update custom data
    if (params.data) {
      await crispClient.website.updatePeopleData(
        config.websiteId,
        params.email,
        params.data
      );
    }

    console.log(`[Crisp] Profile updated for ${params.email}`);
    return true;

  } catch (error) {
    console.error('[Crisp] Failed to update profile:', error);
    return false;
  }
}

/**
 * Send welcome message to new users
 */
export async function sendWelcomeMessage(params: {
  email: string;
  name?: string;
}): Promise<boolean> {
  const welcomeMessage = `
👋 Welcome to AuthiChain AI, ${params.name || 'there'}!

We're excited to help you authenticate your luxury products with AI-powered blockchain technology.

🔐 What you can do:
• Upload product images for instant authentication
• Get blockchain certificates with NFT proof
• Track ownership and transfer history
• Access detailed AI analysis reports

Need help getting started? Just ask! I'm here 24/7. 🚀
  `.trim();

  return sendCrispMessage({
    email: params.email,
    message: welcomeMessage,
  });
}
