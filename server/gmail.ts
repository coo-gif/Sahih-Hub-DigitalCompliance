// Gmail Integration using Replit Connectors
import { google } from 'googleapis';

let connectionSettings: any;
let tokenExpiresAt: number = 0;

async function getAccessToken() {
  const now = Date.now();
  const bufferMs = 60000; // 1 minute buffer before expiry
  
  if (connectionSettings && tokenExpiresAt > now + bufferMs) {
    const cachedToken = connectionSettings?.settings?.access_token || 
                        connectionSettings?.settings?.oauth?.credentials?.access_token;
    if (cachedToken) {
      return cachedToken;
    }
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new Error('Gmail integration not configured. Please set up the Gmail connector.');
  }
  
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Gmail authentication token not available. Please ensure the Gmail connector is properly configured.');
  }

  try {
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch Gmail connection settings');
    }
    
    const data = await response.json();
    connectionSettings = data.items?.[0];
  } catch (error) {
    connectionSettings = null;
    tokenExpiresAt = 0;
    throw new Error('Unable to connect to Gmail. Please check your Gmail integration setup.');
  }

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected. Please connect your Gmail account in the integrations panel.');
  }
  
  // Set expiry time
  if (connectionSettings?.settings?.expires_at) {
    tokenExpiresAt = new Date(connectionSettings.settings.expires_at).getTime();
  } else {
    // Default to 1 hour from now if no expiry provided
    tokenExpiresAt = now + 3600000;
  }
  
  return accessToken;
}

export async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  isUnread: boolean;
  labels: string[];
}

export interface EmailListItem {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  isUnread: boolean;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

function getEmailBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = getEmailBody(part);
        if (nested) return nested;
      }
    }
  }
  
  return '';
}

export async function listEmails(maxResults: number = 20, labelIds: string[] = ['INBOX']): Promise<EmailListItem[]> {
  const gmail = await getGmailClient();
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds,
  });

  const messages = response.data.messages || [];
  const emails: EmailListItem[] = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers = detail.data.payload?.headers || [];
    const labels = detail.data.labelIds || [];
    
    emails.push({
      id: msg.id!,
      threadId: msg.threadId!,
      subject: getHeader(headers, 'Subject') || '(No Subject)',
      from: getHeader(headers, 'From'),
      date: getHeader(headers, 'Date'),
      snippet: detail.data.snippet || '',
      isUnread: labels.includes('UNREAD'),
    });
  }

  return emails;
}

export async function getEmail(messageId: string): Promise<EmailMessage> {
  const gmail = await getGmailClient();
  
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = response.data.payload?.headers || [];
  const labels = response.data.labelIds || [];
  
  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    date: getHeader(headers, 'Date'),
    snippet: response.data.snippet || '',
    body: getEmailBody(response.data.payload),
    isUnread: labels.includes('UNREAD'),
    labels,
  };
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ id: string; threadId: string }> {
  const gmail = await getGmailClient();
  
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  
  const email = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
    },
  });

  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
  };
}

export async function getUnreadCount(): Promise<number> {
  const gmail = await getGmailClient();
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX', 'UNREAD'],
    maxResults: 100,
  });

  return response.data.resultSizeEstimate || 0;
}

export async function markAsRead(messageId: string): Promise<void> {
  const gmail = await getGmailClient();
  
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  });
}

export async function getLabels(): Promise<{ id: string; name: string; type: string }[]> {
  const gmail = await getGmailClient();
  
  const response = await gmail.users.labels.list({
    userId: 'me',
  });

  return (response.data.labels || []).map(label => ({
    id: label.id!,
    name: label.name!,
    type: label.type || 'user',
  }));
}
