import nodemailer, { type Transporter } from "nodemailer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Ensure environment variables are loaded from .env or fallback from .env.example
function loadEnvConfigs() {
  const root = process.cwd();
  const envPath = path.join(root, ".env");
  const envExamplePath = path.join(root, ".env.example");

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else if (fs.existsSync(envExamplePath)) {
    dotenv.config({ path: envExamplePath });
  }
}

loadEnvConfigs();

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  // Re-read env in case updated at runtime
  loadEnvConfigs();

  const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
  const smtpUser = (process.env.SMTP_USER || process.env.MAIL_USER || "").trim();
  // Strip whitespace from passwords (Google App Passwords are provided with spaces like 'xxxx xxxx xxxx xxxx')
  const rawPass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || "").trim();
  const smtpPass = rawPass.replace(/\s+/g, "");

  if (smtpUser && smtpPass) {
    const isGmail = smtpHost.includes("gmail") || smtpUser.endsWith("@gmail.com");

    if (isGmail) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      console.log(`[Email Service] Initialized Gmail SMTP for: ${smtpUser}`);
    } else {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      console.log(`[Email Service] Initialized SMTP host ${smtpHost}:${smtpPort} for: ${smtpUser}`);
    }
  } else {
    console.warn("[Email Service] No SMTP credentials found. Falling back to local logging transport.");
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }

  return transporter;
}

export interface SendVerificationEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a real 6-digit verification email to the user's email address.
 * Never exposes the code in the client API response.
 */
export async function sendVerificationEmail(
  toEmail: string,
  code: string,
  recipientName?: string
): Promise<SendVerificationEmailResult> {
  const mailTransporter = getTransporter();
  const displayName = recipientName?.trim() || "Creator";

  const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER || "";
  const fromAddress = smtpUser
    ? `"AutoCut AI Security" <${smtpUser}>`
    : process.env.SMTP_FROM || '"AutoCut AI Security" <noreply@autocut.ai>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your AutoCut AI Account</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #e4e4e7; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #13131a; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { text-align: center; margin-bottom: 24px; }
          .brand { font-size: 20px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px; }
          .brand span { color: #fbbf24; }
          .title { font-size: 22px; font-weight: bold; color: #ffffff; margin-top: 16px; margin-bottom: 8px; text-align: center; }
          .subtitle { font-size: 14px; color: #a1a1aa; line-height: 1.5; text-align: center; margin-bottom: 28px; }
          .code-box { background: #1c1d27; border: 2px dashed #fbbf24; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px; }
          .code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #fbbf24; }
          .expiry { font-size: 12px; color: #71717a; margin-top: 8px; }
          .footer { font-size: 11px; color: #71717a; text-align: center; border-top: 1px solid #27272a; padding-top: 20px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">AutoCut <span>AI</span></div>
          </div>
          <div class="title">Verify Your Email Address</div>
          <p class="subtitle">
            Hello ${displayName},<br/>
            Thank you for registering for AutoCut AI. Enter the following 6-digit confirmation code on the registration page to activate your account:
          </p>
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="expiry">This verification code expires in 15 minutes.</div>
          </div>
          <p class="subtitle" style="margin-bottom: 12px; font-size: 13px;">
            If you did not create an AutoCut AI account, you can safely disregard this email.
          </p>
          <div class="footer">
            © ${new Date().getFullYear()} AutoCut AI · Professional Video Editing Platform<br/>
            Security Verification Service
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
AutoCut AI Email Verification

Hello ${displayName},

Your 6-digit email verification code is: ${code}

This code will expire in 15 minutes. Enter this code on the registration page to activate your account.

If you did not request this, please disregard this email.
  `.trim();

  try {
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `${code} is your AutoCut AI verification code`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[Email Service] Verification email delivered to ${toEmail} (MessageId: ${info.messageId || "sent"})`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[Email Service] Failed to send email to ${toEmail}:`, err);
    return { success: false, error: err?.message || "Failed to deliver email" };
  }
}
