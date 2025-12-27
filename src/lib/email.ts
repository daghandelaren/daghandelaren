import nodemailer from 'nodemailer';

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface AccessRequestData {
  name: string;
  email: string;
  reason: string;
}

export async function sendAccessRequestEmail(data: AccessRequestData) {
  const { name, email, reason } = data;
  const timestamp = new Date().toISOString();

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: 'ieyuhn@gmail.com',
    subject: `[Daghandelaren] Access Request from ${name}`,
    text: `
New access request for Daghandelaren:

Name: ${name}
Email: ${email}
Reason: ${reason}

Submitted at: ${timestamp}
    `.trim(),
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #3861fb; margin: 0; font-size: 24px;">Daghandelaren</h1>
    <p style="color: #a0a0a0; margin: 5px 0 0 0; font-size: 14px;">Access Request</p>
  </div>

  <h2 style="color: #333; font-size: 18px; margin-bottom: 15px;">New Access Request</h2>

  <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold; width: 100px; color: #555;">Name</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333;">${name}</td>
    </tr>
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Email</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;"><a href="mailto:${email}" style="color: #3861fb;">${email}</a></td>
    </tr>
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555; vertical-align: top;">Reason</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; white-space: pre-wrap;">${reason}</td>
    </tr>
  </table>

  <p style="color: #888; font-size: 12px; margin-top: 20px;">
    Submitted at: ${new Date(timestamp).toLocaleString()}
  </p>
</div>
    `.trim(),
  };

  await transporter.sendMail(mailOptions);
}
