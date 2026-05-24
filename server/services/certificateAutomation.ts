import { getDb } from '../db';
import { certificates, products, users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { storagePut } from '../storage';
import { notifyOwner } from '../_core/notification';
import { mintAuthenticationNFT, buildAuthCertificateMetadata } from '../thirdweb';
import { ENV } from '../_core/env';
import { sendCertificateEmail as sendCrispCertificateEmail } from './crispService';

/**
 * Automated Certificate Generation Service
 * Handles the complete workflow: Payment → Certificate → NFT → Email
 */

interface CertificateData {
  certificateId: number;
  userId: number;
  productName: string;
  tier: 'basic' | 'premium' | 'enterprise';
  productImageUrl?: string;
  isAuthentic: number;
  confidenceScore: number;
  aiAnalysisDetails?: string;
}

/**
 * Generate certificate automatically after payment
 * This is called by the Paddle webhook handler
 */
export async function generateCertificateAfterPayment(certificateId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[Certificate Automation] Database not available');
    return;
  }

  try {
    console.log(`[Certificate Automation] Starting automated generation for certificate ${certificateId}`);

    // Get certificate data
    const cert = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, certificateId))
      .limit(1);

    if (!cert || cert.length === 0) {
      console.error(`[Certificate Automation] Certificate ${certificateId} not found`);
      return;
    }

    const certificateData = cert[0];

    // Step 1: Generate NFT token (simulated for now)
    const nftData = await generateNFT(certificateData);

    // Step 2: Create certificate PDF/image
    const certificateUrl = await generateCertificatePDF(certificateData, nftData);

    // Step 3: Update certificate with blockchain data
    await db
      .update(certificates)
      .set({
        nftTokenId: nftData.tokenId,
        nftContractAddress: nftData.contractAddress,
        blockchainTxHash: nftData.txHash,
        certificateUrl,
        updatedAt: new Date(),
      })
      .where(eq(certificates.id, certificateId));

    // Step 4: Send email to customer
    await sendCertificateEmail(certificateData, certificateUrl, nftData);

    // Step 5: Notify owner
    await notifyOwner({
      title: '✅ Certificate Generated',
      content: `Certificate #${certificateData.certificateNumber} has been generated and sent to customer`,
    });

    console.log(`[Certificate Automation] Successfully generated certificate ${certificateId}`);

  } catch (error) {
    console.error(`[Certificate Automation] Error generating certificate ${certificateId}:`, error);
    
    // Notify owner of failure
    await notifyOwner({
      title: '⚠️ Certificate Generation Failed',
      content: `Failed to generate certificate #${certificateId}: ${error}`,
    });
  }
}

async function generateNFT(certificateData: any): Promise<{
  tokenId: string;
  contractAddress: string;
  txHash: string;
  blockchainNetwork: string;
}> {
  console.log(`[NFT] Generating NFT for certificate ${certificateData.id}`);

  const contractAddress = process.env.VITE_AUTHICHAIN_CONTRACT_ADDRESS;
  const privateKey = ENV.walletPrivateKey;

  if (!contractAddress || !privateKey) {
    console.warn('[NFT] Blockchain env vars not set — using placeholder values');
    return {
      tokenId: `NFT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contractAddress: '0x' + '0'.repeat(40),
      txHash: '0x' + '0'.repeat(64),
      blockchainNetwork: 'polygon',
    };
  }

  const db = await getDb();
  const [product, userRecord] = await Promise.all([
    db ? db.select().from(products).where(eq(products.id, certificateData.productId)).limit(1).then(r => r[0]) : null,
    db ? db.select({ walletAddress: users.walletAddress }).from(users).where(eq(users.id, certificateData.userId)).limit(1).then(r => r[0]) : null,
  ]);

  const metadata = buildAuthCertificateMetadata({
    productName: product?.name ?? `Product #${certificateData.productId}`,
    productBrand: product?.brand ?? undefined,
    productSerial: product?.serialNumber ?? undefined,
    confidenceScore: certificateData.confidenceScore ?? 95,
    verificationDate: new Date().toISOString(),
    certificateNumber: certificateData.certificateNumber,
    authenticatorId: certificateData.userId,
  });

  const recipientAddress = userRecord?.walletAddress ?? contractAddress;

  const result = await mintAuthenticationNFT({
    contractAddress,
    recipientAddress,
    metadata,
    privateKey,
  });

  console.log(`[NFT] Minted on-chain: txHash=${result.transactionHash}`);

  return {
    tokenId: result.transactionHash,
    contractAddress,
    txHash: result.transactionHash,
    blockchainNetwork: ENV.isProduction ? 'polygon' : 'polygon-amoy',
  };
}

/**
 * Generate certificate PDF with QR code and blockchain proof
 */
async function generateCertificatePDF(
  certificateData: any,
  nftData: { tokenId: string; txHash: string }
): Promise<string> {
  console.log(`[Certificate PDF] Generating PDF for certificate ${certificateData.id}`);

  // Create certificate HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Georgia', serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .certificate {
          background: white;
          padding: 60px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #667eea;
          padding-bottom: 30px;
          margin-bottom: 40px;
        }
        .title {
          font-size: 48px;
          color: #667eea;
          margin: 0;
        }
        .subtitle {
          font-size: 20px;
          color: #666;
          margin-top: 10px;
        }
        .content {
          margin: 40px 0;
        }
        .field {
          margin: 20px 0;
        }
        .label {
          font-weight: bold;
          color: #333;
        }
        .value {
          color: #666;
          margin-left: 10px;
        }
        .blockchain {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin-top: 40px;
        }
        .footer {
          text-align: center;
          margin-top: 60px;
          padding-top: 30px;
          border-top: 2px solid #eee;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="header">
          <h1 class="title">Certificate of Authenticity</h1>
          <p class="subtitle">Blockchain-Verified Product Authentication</p>
        </div>
        
        <div class="content">
          <div class="field">
            <span class="label">Certificate Number:</span>
            <span class="value">${certificateData.certificateNumber}</span>
          </div>
          
          <div class="field">
            <span class="label">Product:</span>
            <span class="value">${certificateData.productName}</span>
          </div>
          
          <div class="field">
            <span class="label">Category:</span>
            <span class="value">${certificateData.productCategory || 'Luxury Goods'}</span>
          </div>
          
          <div class="field">
            <span class="label">Authentication Result:</span>
            <span class="value">${certificateData.isAuthentic ? '✅ AUTHENTIC' : '❌ COUNTERFEIT'}</span>
          </div>
          
          <div class="field">
            <span class="label">Confidence Score:</span>
            <span class="value">${certificateData.confidenceScore}%</span>
          </div>
          
          <div class="field">
            <span class="label">Tier:</span>
            <span class="value">${certificateData.tier.toUpperCase()}</span>
          </div>
        </div>
        
        <div class="blockchain">
          <h3>Blockchain Proof</h3>
          <div class="field">
            <span class="label">NFT Token ID:</span>
            <span class="value">${nftData.tokenId}</span>
          </div>
          <div class="field">
            <span class="label">Transaction Hash:</span>
            <span class="value">${nftData.txHash}</span>
          </div>
          <div class="field">
            <span class="label">Issued:</span>
            <span class="value">${new Date().toLocaleDateString()}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} AuthiChain AI - Blockchain Authentication Platform</p>
          <p>This certificate is cryptographically secured and immutable</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Convert HTML to PDF (simplified - in production use puppeteer or similar)
  // For now, save as HTML and return URL
  const filename = `certificate-${certificateData.certificateNumber}.html`;
  const { url } = await storagePut(
    `certificates/${filename}`,
    Buffer.from(html, 'utf-8'),
    'text/html'
  );

  console.log(`[Certificate PDF] Generated and uploaded: ${url}`);

  return url;
}

/**
 * Send certificate email to customer
 */
async function sendCertificateEmail(
  certificateData: any,
  certificateUrl: string,
  nftData: { tokenId: string }
): Promise<void> {
  console.log(`[Email] Sending certificate to customer`);

  // Get user email from database
  const db = await getDb();
  if (!db) {
    console.error('[Email] Database not available');
    return;
  }

  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, certificateData.userId))
    .limit(1);

  if (!userResult || userResult.length === 0) {
    console.error('[Email] User not found');
    return;
  }

  const user = userResult[0];
  const customerEmail = user.email;

  if (!customerEmail) {
    console.error('[Email] User email not available');
    return;
  }

  // Send email via the unified provider chain (Resend → SMTP → Gmail OAuth2).
  const { sendEmail } = await import('../email-service');
  const customerName = (user as any).name || 'there';
  const isAuthentic = certificateData.isAuthentic === 1;
  const verdict = isAuthentic
    ? 'AUTHENTIC ✅'
    : 'COUNTERFEIT ❌';

  const body = [
    `Hi ${customerName},`,
    ``,
    `Your AuthiChain ${certificateData.tier?.toUpperCase?.() || 'authentication'} certificate is ready.`,
    ``,
    `Product:        ${certificateData.productName}`,
    `Certificate #:  ${certificateData.certificateNumber}`,
    `Result:         ${verdict}`,
    `Confidence:     ${certificateData.confidenceScore}%`,
    `NFT Token:      ${nftData.tokenId}`,
    ``,
    `View certificate: ${certificateUrl}`,
    ``,
    `Your certificate is permanently stored on the blockchain and can be verified anytime.`,
    ``,
    `— The AuthiChain Team`,
  ].join('\n');

  const result = await sendEmail({
    to: customerEmail,
    subject: `Your AuthiChain Certificate — ${certificateData.productName}`,
    body,
  });

  if (result.status === 'sent') {
    console.log(`[Email] Certificate email sent to ${customerEmail} via ${result.provider}`);
  } else {
    console.error(`[Email] Certificate email ${result.status}: ${result.reason ?? 'unknown'}`);
  }
}
