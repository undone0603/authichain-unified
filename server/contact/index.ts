import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// POST /api/contact - Handle contact form submissions
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, company, message, subject } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address',
      });
    }

    // Send email via nodemailer if SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const toEmail = process.env.CONTACT_EMAIL || 'hello@authichain.com';

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"${name}" <${smtpUser}>`,
        replyTo: email,
        to: toEmail,
        subject: subject || `Contact form: ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || 'N/A'}\n\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Company:</strong> ${escapeHtml(company || 'N/A')}</p><p><strong>Message:</strong></p><p>${escapeHtml(message)}</p>`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you for your message. We will be in touch shortly.',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process your request. Please try again.',
    });
  }
});

export default router;
