// Turns an uploaded Word / text / HTML file into HTML the document editor understands

export class UnsupportedFileError extends Error {}

const DOCX = /\.docx$/i;

export async function convertUploadedFile(fileName: string, data: Buffer): Promise<string> {
  if (DOCX.test(fileName)) {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer: data });
    return cleanImportedHtml(result.value);
  }
  if (/\.html?$/i.test(fileName)) return cleanImportedHtml(data.toString('utf8'));
  if (/\.txt$/i.test(fileName)) return textToHtml(data.toString('utf8'));
  if (/\.doc$/i.test(fileName)) {
    throw new UnsupportedFileError('Old Word (.doc) files cannot be opened. In Word choose File > Save As > Word Document (.docx), then upload that file.');
  }
  throw new UnsupportedFileError('Upload a Word (.docx), text (.txt) or HTML file. For PDFs or spreadsheets, link the Google file instead.');
}

// Google Docs / Sheets / Slides / Drive links only: the document is kept and opened in Google
export function isGoogleFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['docs.google.com', 'drive.google.com'].includes(url.hostname);
  } catch {
    return false;
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
  html = html.replace(/<a(\s+id="[^"]*")?\s*>\s*<\/a>/gi, '').replace(/<span>([\s\S]*?)<\/span>/gi, '$1').replace(/<p[^>]*>\s*<\/p>/gi, '');

  return html.trim();
}
