async function getNodemailer() {
    return (await import("nodemailer"));
}
function getFrom() {
    const name = process.env.SMTP_FROM_NAME || "AuthiChain";
    const email = process.env.SMTP_FROM || "noreply@authichain.com";
    return `"${name}" <${email}>`;
}
async function createTransporter() {
    const nodemailer = await getNodemailer();
    const nm = nodemailer.default ?? nodemailer;
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true";
    return nm.createTransport({
        host,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER || "",
            pass: process.env.SMTP_PASS || "",
        },
    });
}
export async function sendEmail(options) {
    const transporter = await createTransporter();
    await transporter.sendMail({
        from: options.from || getFrom(),
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments,
    });
}
export async function sendBulkEmails(emails) {
    let sent = 0;
    let failed = 0;
    const transporter = await createTransporter();
    for (const email of emails) {
        try {
            await transporter.sendMail({
                from: email.from || getFrom(),
                to: Array.isArray(email.to) ? email.to.join(", ") : email.to,
                subject: email.subject,
                html: email.html,
                text: email.text,
            });
            sent++;
        }
        catch (err) {
            console.error("[SMTP] Failed to send email to", email.to, err);
            failed++;
        }
    }
    return { sent, failed };
}
export function replaceTemplateVariables(template, vars) {
    return Object.entries(vars).reduce((result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value), template);
}
export function textToHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>")
        .replace(/^(.+)$/, "<p>$1</p>");
}
export async function sendSequenceEmail(to, sequence) {
    for (const step of sequence) {
        if (step.delayMs)
            await new Promise(r => setTimeout(r, step.delayMs));
        await sendEmail({ to, subject: step.subject, html: step.html });
    }
}
export async function verifySMTPConfig() {
    try {
        const transporter = await createTransporter();
        await transporter.verify();
        return true;
    }
    catch {
        return false;
    }
}
