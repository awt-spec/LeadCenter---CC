/**
 * Parser local de User-Agent. Sin dependencias externas.
 *
 * Cubre los casos comunes de browsers/OS modernos. Para análisis
 * forense profundo conviene `ua-parser-js`, pero acá basta para
 * mostrar un icono y un nombre legible.
 */

export type Browser =
  | 'chrome'
  | 'firefox'
  | 'safari'
  | 'edge'
  | 'opera'
  | 'bot'
  | 'other';

export type OS =
  | 'macos'
  | 'windows'
  | 'linux'
  | 'ios'
  | 'android'
  | 'chromeos'
  | 'other';

export type ParsedUA = {
  browser: Browser;
  browserVersion: string | null;
  os: OS;
  isBot: boolean;
};

const BOT_RE = /\b(bot|crawler|spider|slurp|baiduspider|curl|wget|python|node)\b/i;

export function parseUA(ua: string | null | undefined): ParsedUA {
  if (!ua) {
    return { browser: 'other', browserVersion: null, os: 'other', isBot: false };
  }

  const isBot = BOT_RE.test(ua);

  // Browser detection — orden importa: Edge antes de Chrome (Edg/Chromium),
  // Opera antes de Chrome, Safari ÚLTIMO porque casi todo identifica Safari.
  let browser: Browser = 'other';
  let browserVersion: string | null = null;

  if (isBot) {
    browser = 'bot';
  } else if (/Edg\/(\d+)/.test(ua)) {
    browser = 'edge';
    browserVersion = ua.match(/Edg\/(\d+)/)?.[1] ?? null;
  } else if (/OPR\/(\d+)|Opera\/(\d+)/.test(ua)) {
    browser = 'opera';
    browserVersion = ua.match(/OPR\/(\d+)/)?.[1] ?? ua.match(/Opera\/(\d+)/)?.[1] ?? null;
  } else if (/Firefox\/(\d+)/.test(ua)) {
    browser = 'firefox';
    browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] ?? null;
  } else if (/Chrome\/(\d+)/.test(ua) && !/Edg|OPR|Opera/.test(ua)) {
    browser = 'chrome';
    browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] ?? null;
  } else if (/Safari\//.test(ua) && /Version\/(\d+)/.test(ua)) {
    browser = 'safari';
    browserVersion = ua.match(/Version\/(\d+)/)?.[1] ?? null;
  }

  // OS detection — iOS antes de macOS porque iOS reporta Mac OS X también.
  let os: OS = 'other';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'ios';
  else if (/Android/.test(ua)) os = 'android';
  else if (/CrOS/.test(ua)) os = 'chromeos';
  else if (/Mac OS X/.test(ua)) os = 'macos';
  else if (/Windows NT/.test(ua)) os = 'windows';
  else if (/Linux/.test(ua)) os = 'linux';

  return { browser, browserVersion, os, isBot };
}

export function browserLabel(b: Browser): string {
  return {
    chrome: 'Chrome',
    firefox: 'Firefox',
    safari: 'Safari',
    edge: 'Edge',
    opera: 'Opera',
    bot: 'Bot',
    other: 'Otro',
  }[b];
}

export function osLabel(o: OS): string {
  return {
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    ios: 'iOS',
    android: 'Android',
    chromeos: 'ChromeOS',
    other: 'Desconocido',
  }[o];
}
