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
        isRead: !(email.data.labelIds || []).includes('UNREAD')
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
