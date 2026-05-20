import { ENV } from "../_core/env";

async function getSgMail() {
  const m = await import("@sendgrid/mail");
  return (m.default ?? m) as typeof import("@sendgrid/mail");
}

async function init() {
  if (ENV.sendgridApiKey) {
    const sgMail = await getSgMail();
    sgMail.setApiKey(ENV.sendgridApiKey);
  }
}

function getFromEmail(): string {
  return process.env.SENDGRID_FROM_EMAIL || "noreply@authichain.com";
}

function getFromName(): string {
  return process.env.SENDGRID_FROM_NAME || "AuthiChain";
}

export interface CertificateEmailParams {
  to: string;
  recipientName: string;
  productName: string;
  certificateNumber: string;
  verifyUrl: string;
  issuedAt?: string;
}

export async function sendCertificateEmail(params: CertificateEmailParams): Promise<void> {
  const sgMail = await getSgMail();
  await init();
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Authentication Certificate</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px;">&#x2713; Authentication Certificate</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">AuthiChain Blockchain Verification</p>
      </div>
      <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 12px 12px;">
        <p>Dear ${params.recipientName || "Customer"},</p>
        <p>Your product <strong>${params.productName}</strong> has been successfully authenticated.</p>
        <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Certificate Number</p>
          <p style="margin: 5px 0; font-size: 20px; font-weight: bold; font-family: monospace; color: #1f2937;">${params.certificateNumber}</p>
          ${params.issuedAt ? `<p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Issued: ${params.issuedAt}</p>` : ""}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.verifyUrl}" style="background: #667eea; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Certificate</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This certificate is stored on the blockchain and can be independently verified at any time.</p>
      </div>
    </body>
    </html>
  `;
  await sgMail.send({
    to: params.to,
    from: { email: getFromEmail(), name: getFromName() },
    subject: `Authentication Certificate — ${params.productName}`,
    html,
  });
}

export interface WelcomeEmailParams {
  to: string;
  name: string;
  loginUrl?: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const sgMail = await getSgMail();
  await init();
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Welcome to AuthiChain</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px;">Welcome to AuthiChain!</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Blockchain-Powered Product Authentication</p>
      </div>
      <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 12px 12px;">
        <p>Hi ${params.name || "there"},</p>
        <p>Welcome to AuthiChain — your platform for AI-powered product authentication backed by blockchain technology.</p>
        <ul style="color: #374151; line-height: 1.8;">
          <li>Authenticate products with AI confidence scoring</li>
          <li>Issue tamper-proof certificates on the blockchain</li>
          <li>Track supply chain events in real time</li>
          <li>Mint NFTs for authenticated items</li>
        </ul>
        ${params.loginUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.loginUrl}" style="background: #667eea; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Get Started</a>
        </div>` : ""}
        <p style="color: #6b7280; font-size: 14px;">Questions? Reply to this email and we'll be happy to help.</p>
      </div>
    </body>
    </html>
  `;
  await sgMail.send({
    to: params.to,
    from: { email: getFromEmail(), name: getFromName() },
    subject: "Welcome to AuthiChain — Let's get started!",
    html,
  });
}
