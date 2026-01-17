import { google } from 'googleapis';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.modify'
];

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getOAuth2Client(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

export function getAuthUrl(redirectUri: string, state: string): string {
  const oauth2Client = getOAuth2Client(redirectUri);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
    prompt: 'consent'
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const oauth2Client = getOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function saveUserGmailTokens(
  userId: number,
  accessToken: string,
  refreshToken: string | null | undefined,
  expiryDate: number | null | undefined
) {
  const tokenExpiry = expiryDate ? new Date(expiryDate) : null;
  
  await db.update(users)
    .set({
      gmailAccessToken: accessToken,
      gmailRefreshToken: refreshToken || null,
      gmailTokenExpiry: tokenExpiry,
      gmailConnectedAt: new Date()
    })
    .where(eq(users.id, userId));
}

export async function getUserGmailTokens(userId: number) {
  const [user] = await db.select({
    gmailAccessToken: users.gmailAccessToken,
    gmailRefreshToken: users.gmailRefreshToken,
    gmailTokenExpiry: users.gmailTokenExpiry,
    gmailConnectedAt: users.gmailConnectedAt
  })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);
  
  return user;
}

export async function disconnectUserGmail(userId: number) {
  await db.update(users)
    .set({
      gmailAccessToken: null,
      gmailRefreshToken: null,
      gmailTokenExpiry: null,
      gmailConnectedAt: null
    })
    .where(eq(users.id, userId));
}

export async function getAuthenticatedGmailClient(userId: number) {
  const tokens = await getUserGmailTokens(userId);
  
  if (!tokens?.gmailAccessToken) {
    throw new Error('Gmail not connected for this user');
  }
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.gmailAccessToken,
    refresh_token: tokens.gmailRefreshToken,
    expiry_date: tokens.gmailTokenExpiry?.getTime()
  });
  
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      const updateData: { 
        gmailAccessToken: string; 
        gmailTokenExpiry: Date | null;
        gmailRefreshToken?: string;
      } = {
        gmailAccessToken: newTokens.access_token,
        gmailTokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
      };
      
      if (newTokens.refresh_token) {
        updateData.gmailRefreshToken = newTokens.refresh_token;
      }
      
      await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId));
    }
  });
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function sendEmailWithUserAccount(
  userId: number,
  to: string,
  subject: string,
  body: string
) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  });
  
  return response.data;
}

export async function getEmailsWithUserAccount(
  userId: number, 
  maxResults: number = 20,
  label: 'INBOX' | 'SENT' | 'UNREAD' = 'INBOX'
) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  const labelIds: string[] = label === 'UNREAD' 
    ? ['INBOX', 'UNREAD']
    : [label];
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: maxResults,
    labelIds: labelIds
  });
  
  const messages = response.data.messages || [];
  const emails = await Promise.all(
    messages.map(async (msg) => {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full'
      });
      
      const headers = email.data.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      
      let body = '';
      if (email.data.payload?.body?.data) {
        body = Buffer.from(email.data.payload.body.data, 'base64').toString('utf-8');
      } else if (email.data.payload?.parts) {
        const htmlPart = email.data.payload.parts.find(p => p.mimeType === 'text/html');
        const textPart = email.data.payload.parts.find(p => p.mimeType === 'text/plain');
        const part = htmlPart || textPart;
        if (part?.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
      
      return {
        id: email.data.id,
        threadId: email.data.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        snippet: email.data.snippet,
        body: body,
        labelIds: email.data.labelIds || [],
        isUnread: (email.data.labelIds || []).includes('UNREAD')
      };
    })
  );
  
  return emails;
}

export async function getUnreadCountWithUserAccount(userId: number): Promise<number> {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX', 'UNREAD'],
    maxResults: 100
  });
  
  return response.data.resultSizeEstimate || 0;
}

export async function markEmailAsReadWithUserAccount(userId: number, messageId: string) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD']
    }
  });
}

export async function deleteEmailWithUserAccount(userId: number, messageId: string) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  await gmail.users.messages.trash({
    userId: 'me',
    id: messageId
  });
}

export async function archiveEmailWithUserAccount(userId: number, messageId: string) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['INBOX']
    }
  });
}

export async function starEmailWithUserAccount(userId: number, messageId: string) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: ['STARRED']
    }
  });
}

export async function unstarEmailWithUserAccount(userId: number, messageId: string) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['STARRED']
    }
  });
}

export async function getEmailWithUserAccount(userId: number, messageId: string) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  const email = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'
  });
  
  const headers = email.data.payload?.headers || [];
  const getHeader = (name: string) => 
    headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
  
  let body = '';
  if (email.data.payload?.body?.data) {
    body = Buffer.from(email.data.payload.body.data, 'base64').toString('utf-8');
  } else if (email.data.payload?.parts) {
    const htmlPart = findPartByMimeType(email.data.payload.parts, 'text/html');
    const textPart = findPartByMimeType(email.data.payload.parts, 'text/plain');
    const part = htmlPart || textPart;
    if (part?.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
  }
  
  // Extract attachments info
  const attachments = extractAttachments(email.data.payload);
  
  return {
    id: email.data.id,
    threadId: email.data.threadId,
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    bcc: getHeader('Bcc'),
    date: getHeader('Date'),
    snippet: email.data.snippet,
    body: body,
    labelIds: email.data.labelIds || [],
    isUnread: (email.data.labelIds || []).includes('UNREAD'),
    attachments
  };
}

function findPartByMimeType(parts: any[], mimeType: string): any {
  for (const part of parts) {
    if (part.mimeType === mimeType) {
      return part;
    }
    if (part.parts) {
      const found = findPartByMimeType(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

function extractAttachments(payload: any): { filename: string; mimeType: string; size: number; attachmentId: string }[] {
  const attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[] = [];
  
  function processpart(part: any) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId
      });
    }
    if (part.parts) {
      part.parts.forEach(processpart);
    }
  }
  
  if (payload?.parts) {
    payload.parts.forEach(processpart);
  }
  
  return attachments;
}

export async function getThreadWithUserAccount(userId: number, threadId: string) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full'
  });
  
  const messages = thread.data.messages || [];
  
  return messages.map((msg: any) => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => 
      headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
    
    let body = '';
    if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
    } else if (msg.payload?.parts) {
      const htmlPart = findPartByMimeType(msg.payload.parts, 'text/html');
      const textPart = findPartByMimeType(msg.payload.parts, 'text/plain');
      const part = htmlPart || textPart;
      if (part?.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
    
    const attachments = extractAttachments(msg.payload);
    
    return {
      id: msg.id,
      threadId: msg.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      cc: getHeader('Cc'),
      bcc: getHeader('Bcc'),
      date: getHeader('Date'),
      snippet: msg.snippet,
      body: body,
      labelIds: msg.labelIds || [],
      isUnread: (msg.labelIds || []).includes('UNREAD'),
      attachments
    };
  });
}

export async function sendEmailWithAttachments(
  userId: number,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  attachments?: { filename: string; mimeType: string; content: string }[],
  inReplyTo?: string,
  references?: string
) {
  const gmail = await getAuthenticatedGmailClient(userId);
  
  const boundary = '----=_Part_' + Math.random().toString(36).substring(2);
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  
  let messageParts = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${utf8Subject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    references ? `References: ${references}` : '',
    'MIME-Version: 1.0',
  ].filter(Boolean);
  
  if (attachments && attachments.length > 0) {
    messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    messageParts.push('');
    messageParts.push(`--${boundary}`);
    messageParts.push('Content-Type: text/html; charset=utf-8');
    messageParts.push('');
    messageParts.push(body);
    
    for (const attachment of attachments) {
      messageParts.push(`--${boundary}`);
      messageParts.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      messageParts.push('');
      messageParts.push(attachment.content);
    }
    
    messageParts.push(`--${boundary}--`);
  } else {
    messageParts.push('Content-Type: text/html; charset=utf-8');
    messageParts.push('');
    messageParts.push(body);
  }
  
  const message = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  });
  
  return response.data;
}
