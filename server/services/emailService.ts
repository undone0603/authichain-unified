import sgMail from '@sendgrid/mail';

/**
 * SendGrid Email Service
 * Handles automated email delivery for certificates and notifications
 */

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

let isConfigured = false;

/**
 * Initialize SendGrid with API key
 */
function initializeSendGrid(): EmailConfig | null {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@authichain.ai';
  const fromName = process.env.SENDGRID_FROM_NAME || 'AuthiChain AI';

  if (!apiKey) {
    console.warn('[Email] SendGrid API key not configured - emails will be logged to console');
    return null;
  }

  if (!isConfigured) {
    sgMail.setApiKey(apiKey);
    isConfigured = true;
    console.log('[Email] SendGrid initialized successfully');
  }

  return { apiKey, fromEmail, fromName };
}

/**
 * Send certificate email to customer
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
  const config = initializeSendGrid();

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

  const subject = `Your AuthiChain Certificate is Ready! 🎉`;
  
  const html = generateCertificateEmailHTML({
    customerName: customerName || 'Valued Customer',
    certificateNumber,
    productName,
    tier,
    isAuthentic,
    confidenceScore,
    certificateUrl,
    nftTokenId,
  });

  const text = generateCertificateEmailText(params);

  // If SendGrid is not configured, log to console
  if (!config) {
    console.log('[Email] Would send certificate email:');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Certificate URL: ${certificateUrl}`);
    console.log('---');
    return true;
  }

  try {
    await sgMail.send({
      to,
      from: {
        email: config.fromEmail,
        name: config.fromName,
      },
      subject,
      text,
      html,
    });

    console.log(`[Email] Certificate email sent successfully to ${to}`);
    return true;

  } catch (error: any) {
    console.error('[Email] Failed to send certificate email:', error);
    
    if (error.response) {
      console.error('[Email] SendGrid error:', error.response.body);
    }
    
    return false;
  }
}

/**
 * Generate HTML email template for certificate
 */
function generateCertificateEmailHTML(params: {
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

  const statusBadge = isAuthentic
    ? '<span style="background: #10b981; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold;">✅ AUTHENTIC</span>'
    : '<span style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold;">❌ COUNTERFEIT</span>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AuthiChain Certificate</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">🔐 AuthiChain AI</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">Blockchain Authentication Platform</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px;">Hello ${customerName}! 👋</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your <strong>${tier.toUpperCase()}</strong> authentication certificate has been generated and is ready to view!
              </p>

              <!-- Certificate Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 30px 0;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">Certificate Details</h3>
                    
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Product:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">${productName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Certificate #:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">${certificateNumber}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Result:</td>
                        <td style="padding: 8px 0; text-align: right;">${statusBadge}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Confidence:</td>
                        <td style="color: #1f2937; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">${confidenceScore}%</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">NFT Token:</td>
                        <td style="color: #667eea; font-size: 12px; font-family: monospace; padding: 8px 0; text-align: right;">${nftTokenId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${certificateUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      View Your Certificate →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Your certificate is permanently stored on the blockchain and can be verified at any time. The NFT token provides immutable proof of authenticity.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                © ${new Date().getFullYear()} AuthiChain AI - Blockchain Authentication Platform
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Powered by AI & Blockchain Technology
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generate plain text version of certificate email
 */
function generateCertificateEmailText(params: {
  customerName?: string;
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

  return `
Hello ${customerName || 'Valued Customer'}!

Your ${tier.toUpperCase()} authentication certificate has been generated and is ready to view!

Certificate Details:
- Product: ${productName}
- Certificate Number: ${certificateNumber}
- Authentication Result: ${isAuthentic ? 'AUTHENTIC ✅' : 'COUNTERFEIT ❌'}
- Confidence Score: ${confidenceScore}%
- NFT Token: ${nftTokenId}

View your certificate: ${certificateUrl}

Your certificate is permanently stored on the blockchain and can be verified at any time.

Thank you for choosing AuthiChain AI!

Best regards,
The AuthiChain Team

---
© ${new Date().getFullYear()} AuthiChain AI - Blockchain Authentication Platform
  `.trim();
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(params: {
  to: string;
  name?: string;
}): Promise<boolean> {
  const config = initializeSendGrid();

  if (!config) {
    console.log('[Email] Would send welcome email to:', params.to);
    return true;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: {
        email: config.fromEmail,
        name: config.fromName,
      },
      subject: 'Welcome to AuthiChain AI! 🚀',
      text: `Welcome to AuthiChain AI, ${params.name || 'there'}! Start authenticating your luxury products with blockchain technology.`,
      html: `<p>Welcome to AuthiChain AI, <strong>${params.name || 'there'}</strong>!</p><p>Start authenticating your luxury products with blockchain technology.</p>`,
    });

    console.log(`[Email] Welcome email sent to ${params.to}`);
    return true;

  } catch (error) {
    console.error('[Email] Failed to send welcome email:', error);
    return false;
  }
}
