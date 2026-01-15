// SMTP Email Service using Nodemailer
// This allows sending emails through a configured company Gmail account
// without requiring each user to have Replit access

import nodemailer from 'nodemailer';

interface EmailConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
}

let transporter: nodemailer.Transporter | null = null;

function getEmailConfig(): EmailConfig | null {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const password = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD;
  
  if (!user || !password) {
    return null;
  }
  
  return {
    user,
    password,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
  };
}

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }
  
  const config = getEmailConfig();
  if (!config) {
    throw new Error('Email not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD secrets.');
  }
  
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
  
  return transporter;
}

export function isSmtpConfigured(): boolean {
  const config = getEmailConfig();
  return config !== null;
}

export async function sendEmailSmtp(
  to: string, 
  subject: string, 
  htmlBody: string
): Promise<{ messageId: string }> {
  const transport = getTransporter();
  const config = getEmailConfig();
  
  if (!config) {
    throw new Error('Email not configured');
  }
  
  const result = await transport.sendMail({
    from: config.user,
    to,
    subject,
    html: htmlBody,
  });
  
  return { messageId: result.messageId };
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  htmlBody: string,
  attachments: Array<{ filename: string; content: Buffer | string; contentType?: string }>
): Promise<{ messageId: string }> {
  const transport = getTransporter();
  const config = getEmailConfig();
  
  if (!config) {
    throw new Error('Email not configured');
  }
  
  const result = await transport.sendMail({
    from: config.user,
    to,
    subject,
    html: htmlBody,
    attachments,
  });
  
  return { messageId: result.messageId };
}

export async function verifyConnection(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return true;
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    return false;
  }
}
