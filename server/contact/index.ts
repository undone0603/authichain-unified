import { Router, Request, Response } from 'express';
import { Resend } from 'resend';

const router = Router();

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

    // Send email notification via Resend if configured
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'contact@authichain.com';
      const toEmail = process.env.CONTACT_TO_EMAIL || 'hello@authichain.com';

      await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: subject || `New Contact Form Submission from ${name}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `,
        replyTo: email,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you for your message. We will be in touch shortly.',
    });
  } catch (error) {
    console.error('[contact] Error processing contact form:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again later.',
    });
  }
});

export default router;
