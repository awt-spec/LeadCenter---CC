// Detecta el tipo de recurso desde el dominio y extrae metadata Open Graph.
// Intencionalmente conservador: si la página no responde rápido o falla
// el parseo, devolvemos lo que tenemos sin reventar el flujo de creación.

import type { LinkType } from './schemas';

const TYPE_BY_HOST: Array<{ match: RegExp; type: LinkType }> = [
  { match: /(^|\.)lovable\.(dev|app)$/i, type: 'LOVABLE' },
  { match: /(^|\.)figma\.com$/i, type: 'FIGMA' },
  { match: /(^|\.)docs\.google\.com$/i, type: 'DOCUMENT' },
  { match: /(^|\.)slides\.google\.com$/i, type: 'PRESENTATION' },
  { match: /(^|\.)sheets\.google\.com$/i, type: 'SPREADSHEET' },
  { match: /(^|\.)drive\.google\.com$/i, type: 'DOCUMENT' },
  { match: /(^|\.)notion\.(so|site)$/i, type: 'DOCUMENT' },
  { match: /(^|\.)pitch\.com$/i, type: 'PRESENTATION' },
  { match: /(^|\.)canva\.com$/i, type: 'PRESENTATION' },
  { match: /(^|\.)gamma\.app$/i, type: 'PRESENTATION' },
  { match: /(^|\.)slid\.es$/i, type: 'PRESENTATION' },
  { match: /(^|\.)loom\.com$/i, type: 'VIDEO' },
  { match: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, type: 'VIDEO' },
  { match: /(^|\.)vimeo\.com$/i, type: 'VIDEO' },
  { match: /(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)bitbucket\.org$/i, type: 'REPO' },
  { match: /(^|\.)airtable\.com$/i, type: 'SPREADSHEET' },
  { match: /(^|\.)dropbox\.com$/i, type: 'DOCUMENT' },
];

export function detectLinkType(url: string): LinkType {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const rule of TYPE_BY_HOST) {
      if (rule.match.test(host)) return rule.type;
    }
    // Heuristic on path: .pdf / .pptx / .xlsx / .docx
    const path = new URL(url).pathname.toLowerCase();
    if (/\.(pdf|pptx?|key)$/i.test(path)) return 'PRESENTATION';
    if (/\.(xlsx?|csv|numbers)$/i.test(path)) return 'SPREADSHEET';
    if (/\.(docx?|md|rtf|odt)$/i.test(path)) return 'DOCUMENT';
    if (/\.(mp4|mov|webm|m4v)$/i.test(path)) return 'VIDEO';
    return 'WEBSITE';
  } catch {
    return 'OTHER';
  }
}

export function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

interface Preview {
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  domain: string | null;
  type: LinkType;
}

/// Best-effort OG/Twitter card scrape. Bounded by AbortSignal so a slow page
/// never blocks the user — they can still save the link manually.
export async function fetchUrlPreview(url: string, timeoutMs = 5000): Promise<Preview> {
  const domain = getDomain(url);
  const type = detectLinkType(url);
  const fallback: Preview = { title: null, description: null, thumbnail: null, domain, type };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Pretend to be a regular browser — many sites refuse otherwise.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es,en;q=0.8',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html')) return fallback;

    // Cap the body we read — we only need <head>.
    const reader = res.body?.getReader();
    if (!reader) return fallback;
    const dec = new TextDecoder();
    let html = '';
    let total = 0;
    const cap = 64 * 1024; // 64 KB
    while (total < cap) {
      const { value, done } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      total += value.length;
      // Bail early once </head> appears
      if (html.toLowerCase().includes('</head>')) break;
    }
    try {
      reader.cancel().catch(() => {});
    } catch {
      // ignore
    }

    return {
      ...fallback,
      title: pickMeta(html, [
        ['property', 'og:title'],
        ['name', 'twitter:title'],
      ]) ?? pickTitle(html),
      description: pickMeta(html, [
        ['property', 'og:description'],
        ['name', 'twitter:description'],
        ['name', 'description'],
      ]),
      thumbnail: pickMeta(html, [
        ['property', 'og:image'],
        ['name', 'twitter:image'],
        ['name', 'twitter:image:src'],
      ]),
    };
  } catch {
    return fallback;
  }
}

function pickMeta(html: string, attrs: Array<[string, string]>): string | null {
  for (const [attr, val] of attrs) {
    // Accept either <meta property="..." content="..."> or reversed order.
    const re1 = new RegExp(
      `<meta[^>]*${attr}=["']${escapeRe(val)}["'][^>]*content=["']([^"']+)["']`,
      'i'
    );
    const re2 = new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${escapeRe(val)}["']`,
      'i'
    );
    const m = html.match(re1) ?? html.match(re2);
    if (m?.[1]) return decodeEntities(m[1].trim()).slice(0, 500);
  }
  return null;
}

function pickTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].trim()).slice(0, 500) : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
