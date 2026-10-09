import { google } from 'googleapis';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '@shared/schema';
import { getOAuth2Client } from './gmail-oauth';

// Read-only: the app only lists and reads files the user chooses to import
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export const GOOGLE_DOC = 'application/vnd.google-apps.document';
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const IMPORTABLE_MIME_TYPES = [GOOGLE_DOC, DOCX, 'text/plain', 'text/html'];

export function getDriveAuthUrl(redirectUri: string, state: string): string {
  return getOAuth2Client(redirectUri).generateAuthUrl({
    access_type: 'offline',
    scope: DRIVE_SCOPES,
    state,
    prompt: 'consent',
    include_granted_scopes: true,
  });
}

export async function saveUserDriveTokens(userId: number, accessToken: string, refreshToken: string | null | undefined, expiryDate: number | null | undefined) {
  await db.update(users).set({
    driveAccessToken: accessToken,
    driveRefreshToken: refreshToken || null,
    driveTokenExpiry: expiryDate ? new Date(expiryDate) : null,
    driveConnectedAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function getDriveConnection(userId: number) {
  const [row] = await db.select({
    driveAccessToken: users.driveAccessToken,
    driveRefreshToken: users.driveRefreshToken,
    driveTokenExpiry: users.driveTokenExpiry,
    driveConnectedAt: users.driveConnectedAt,
  }).from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

export async function disconnectUserDrive(userId: number) {
  await db.update(users).set({
    driveAccessToken: null,
    driveRefreshToken: null,
    driveTokenExpiry: null,
    driveConnectedAt: null,
  }).where(eq(users.id, userId));
}

async function driveClient(userId: number) {
  const tokens = await getDriveConnection(userId);
  if (!tokens?.driveAccessToken) throw new DriveNotConnectedError();
  const auth = getOAuth2Client();
  auth.setCredentials({
    access_token: tokens.driveAccessToken,
    refresh_token: tokens.driveRefreshToken,
    expiry_date: tokens.driveTokenExpiry?.getTime(),
  });
  auth.on('tokens', async (fresh) => {
    if (!fresh.access_token) return;
    await db.update(users).set({
      driveAccessToken: fresh.access_token,
      driveTokenExpiry: fresh.expiry_date ? new Date(fresh.expiry_date) : null,
      ...(fresh.refresh_token ? { driveRefreshToken: fresh.refresh_token } : {}),
    }).where(eq(users.id, userId));
  });
  return google.drive({ version: 'v3', auth });
}

export class DriveNotConnectedError extends Error {
  constructor() { super('Google Drive is not connected'); }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  owner: string | null;
  webViewLink: string | null;
  importable: boolean;
}

// Documents the user can see in Drive, newest first; optional name search
export async function listDriveFiles(userId: number, search?: string): Promise<DriveFile[]> {
  const drive = await driveClient(userId);
  const typeFilter = [...IMPORTABLE_MIME_TYPES, 'application/pdf'].map(t => `mimeType = '${t}'`).join(' or ');
  const nameFilter = search ? ` and name contains '${search.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : '';
  const { data } = await drive.files.list({
    q: `trashed = false and (${typeFilter})${nameFilter}`,
    orderBy: 'modifiedTime desc',
    pageSize: 50,
    fields: 'files(id, name, mimeType, modifiedTime, owners(displayName), webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (data.files || []).map(f => ({
    id: f.id!,
    name: f.name || 'Untitled',
    mimeType: f.mimeType || '',
    modifiedTime: f.modifiedTime || null,
    owner: f.owners?.[0]?.displayName || null,
    webViewLink: f.webViewLink || null,
    importable: IMPORTABLE_MIME_TYPES.includes(f.mimeType || ''),
  }));
}

export interface ImportedFile {
  fileName: string;
  title: string;
  mimeType: string;
  webViewLink: string | null;
  html: string;
}

// Opens a Drive file and turns it into HTML the document editor understands
export async function importDriveFile(userId: number, fileId: string): Promise<ImportedFile> {
  const drive = await driveClient(userId);
  const { data: meta } = await drive.files.get({ fileId, fields: 'id, name, mimeType, webViewLink', supportsAllDrives: true });
  const mimeType = meta.mimeType || '';
  let html: string;
  if (mimeType === GOOGLE_DOC) {
    const { data } = await drive.files.export({ fileId, mimeType: 'text/html' }, { responseType: 'text' });
    html = cleanImportedHtml(String(data));
  } else if (mimeType === DOCX) {
    const { data } = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(data as ArrayBuffer) });
    html = cleanImportedHtml(result.value);
  } else if (mimeType === 'text/html') {
    const { data } = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'text' });
    html = cleanImportedHtml(String(data));
  } else if (mimeType === 'text/plain') {
    const { data } = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'text' });
    html = textToHtml(String(data));
  } else {
    throw new UnsupportedFileError(mimeType);
  }
  const fileName = meta.name || 'Untitled';
  return {
    fileName,
    title: fileName.replace(/\.(docx?|txt|html?)$/i, ''),
    mimeType,
    webViewLink: meta.webViewLink || null,
    html,
  };
}

export class UnsupportedFileError extends Error {
  constructor(public mimeType: string) {
    super(mimeType === 'application/pdf'
      ? 'PDF files cannot be imported as editable text. Open the PDF in Google Docs (File > Open with > Google Docs) and import that copy.'
      : 'This file type cannot be imported. Use a Google Doc, a Word (.docx) file or a text file.');
  }
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Turns exported HTML (Google Docs, Word via mammoth) into what the editor keeps:
 * Google Docs puts formatting in class rules, so those are copied inline (bold, italic,
 * underline, alignment are then recognised); headings become bold paragraphs because the
 * editor has no heading blocks; scripts, styles and page furniture are dropped.
 */
export function cleanImportedHtml(raw: string): string {
  // CSS class rules from the exported <style> block, e.g. .c3{font-weight:700}
  const classStyles = new Map<string, string>();
  for (const block of Array.from(raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))) {
    for (const rule of Array.from(block[1].matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g))) {
      const kept = rule[2].split(';')
        .map(d => d.trim())
        .filter(d => /^(font-weight|font-style|text-decoration|text-align)\s*:/i.test(d))
        .join(';');
      if (kept) classStyles.set(rule[1], kept);
    }
  }

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1] : raw;

  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|meta|link|title)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(meta|link)[^>]*\/?>/gi, '');

  // Copy class styles inline, then drop class/id attributes
  html = html.replace(/<([a-z][a-z0-9]*)([^>]*)>/gi, (_tag, name: string, attrs: string) => {
    let style = '';
    const classMatch = attrs.match(/\sclass="([^"]*)"/i);
    if (classMatch) {
      style = classMatch[1].split(/\s+/).map(c => classStyles.get(c)).filter(Boolean).join(';');
    }
    const inlineMatch = attrs.match(/\sstyle="([^"]*)"/i);
    if (inlineMatch) {
      const keptInline = inlineMatch[1].split(';').map(d => d.trim())
        .filter(d => /^(font-weight|font-style|text-decoration|text-align)\s*:/i.test(d)).join(';');
      style = [style, keptInline].filter(Boolean).join(';');
    }
    let rest = attrs
      .replace(/\s(class|id|style|dir|lang)="[^"]*"/gi, '')
      .replace(/\s(class|id|style|dir|lang)='[^']*'/gi, '');
    if (style) rest += ` style="${style}"`;
    return `<${name}${rest}>`;
  });

  // The editor has no heading blocks: keep headings visible as bold paragraphs
  html = html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_m, _level, attrs: string, inner: string) => `<p${attrs}><strong>${inner}</strong></p>`);

  // Google wraps every link through google.com/url?q=...
  html = html.replace(/href="https:\/\/www\.google\.com\/url\?q=([^"&]+)[^"]*"/gi, (_m, target: string) => `href="${decodeURIComponent(target)}"`);

  // Empty spans and paragraphs left by the export
  html = html.replace(/<span>([\s\S]*?)<\/span>/gi, '$1').replace(/<p[^>]*>\s*<\/p>/gi, '');

  return html.trim();
}
