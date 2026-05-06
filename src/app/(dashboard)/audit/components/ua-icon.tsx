import { Bot, Chrome, Globe, Smartphone, Monitor } from 'lucide-react';
import {
  parseUA,
  browserLabel,
  osLabel,
  type Browser,
  type OS,
} from '@/lib/audit/ua-parser';

function browserIcon(b: Browser) {
  switch (b) {
    case 'chrome':
      return <Chrome className="h-3.5 w-3.5" />;
    case 'bot':
      return <Bot className="h-3.5 w-3.5" />;
    default:
      return <Globe className="h-3.5 w-3.5" />;
  }
}

function osIcon(o: OS) {
  if (o === 'ios' || o === 'android') return <Smartphone className="h-3 w-3" />;
  return <Monitor className="h-3 w-3" />;
}

const BROWSER_COLOR: Record<Browser, string> = {
  chrome: 'text-blue-500',
  firefox: 'text-orange-500',
  safari: 'text-sky-500',
  edge: 'text-cyan-600',
  opera: 'text-red-500',
  bot: 'text-amber-600',
  other: 'text-sysde-mid',
};

export function UAIcon({ ua }: { ua: string | null | undefined }) {
  if (!ua) return <span className="text-sysde-mid text-xs">—</span>;
  const p = parseUA(ua);
  const tooltip = `${browserLabel(p.browser)}${p.browserVersion ? ' ' + p.browserVersion : ''} · ${osLabel(p.os)}\n${ua}`;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-sysde-mid"
      title={tooltip}
    >
      <span className={BROWSER_COLOR[p.browser]}>{browserIcon(p.browser)}</span>
      <span className="text-sysde-mid">{osIcon(p.os)}</span>
    </span>
  );
}
