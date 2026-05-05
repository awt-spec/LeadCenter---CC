// Account de-duplication. Each Asana task points at a company; we want to
// match it against the existing LC account (most often imported from HubSpot)
// instead of creating a parallel record.
//
// Strategy:
//   1. Exact name match (case + accent insensitive).
//   2. Token overlap >= 2 distinctive tokens.
//   3. Domain hint extracted from notes/stories (if any URL like @example.com).
//
// We deliberately don't auto-merge on weak (1-token) matches — those go to
// "create new" and the user can merge later from the bulk-actions UI.

import type { PrismaClient } from '@prisma/client';
import type { AsanaTask } from './asana-client';
import { extractCompanyName, mapCountry } from './mappers';

interface CandidateAccount {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
}

type DedupAction =
  | { type: 'reuse'; accountId: string; matchedBy: 'exact' | 'tokens' | 'domain' | 'email-domain'; accountName: string; confidence: number }
  /// 'create' is reserved for the special "Asana - Tareas internas" bucket
  /// (used only for generic task names that don't represent a prospect).
  | { type: 'create'; companyName: '__ASANA_GENERIC__' }
  /// Skip = no match found in LC, and the task isn't a generic template either.
  /// Per user request we don't create new accounts for tasks where the
  /// prospect isn't already in LC — those just don't get imported.
  | { type: 'skip'; reason: string };

export interface DedupPlan {
  taskGid: string;
  asanaName: string;
  companyName: string;
  action: DedupAction;
  /// Tasks that map to the same target account — used for the summary.
  groupKey: string;
}

/// Lowercase, strip accents, collapse whitespace. Used for both LC and Asana
/// names so the comparison is stable regardless of how each system stored
/// them.
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s.&]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  // Spanish articles/connectors
  'de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'o', 'con', 'sin', 'por', 'para',
  // Corporate suffixes (English/Spanish/Latin America)
  'sa', 'sas', 's.a', 's.a.', 's.a.s', 's.r.l', 'srl', 'sas', 'cia', 'ltda', 'ltd',
  'inc', 'corp', 'corporation', 'company', 'co', 'group', 'grupo',
  'sociedad', 'compania', 'compañia', 'pcl', 'plc',
  // Mexican/LatAm corporate forms
  'sapi', 'sofom', 'enr', 'sapib', 'sab', 'spi', 'eric', 'sofome', 'er',
  'sociedadanonima', 'spe', 'sapilcv', 'cv',
  // Generic financial terms (alone they don't identify a company)
  'banco', 'bank', 'caja', 'fondo', 'fondos', 'cooperativa', 'asociacion',
  'ahorro', 'credito', 'creditos', 'rural', 'urbano', 'financiera',
  'leasing', 'arrendamiento', 'arrendadora', 'factoring', 'factoraje',
  'pensiones', 'pension', 'seguros', 'seguro', 'fideicomiso',
  // Geographic markers (countries + common region words)
  'mexico', 'mexicano', 'mexicana', 'guatemala', 'salvador', 'honduras',
  'nicaragua', 'costa', 'rica', 'panama', 'panamá', 'colombia', 'colombiano',
  'peru', 'perú', 'chile', 'argentina', 'uruguay', 'paraguay', 'bolivia',
  'ecuador', 'venezuela', 'dominicana', 'república', 'republica', 'puerto',
  'rico', 'cuba', 'brasil', 'brazil', 'estados', 'unidos', 'spain',
  'españa', 'espana', 'colombiana', 'peruana', 'salvadoreña', 'salvadoreno',
  // Industry-generic
  'tecnologia', 'tecnología', 'servicios', 'service', 'services', 'soluciones',
  'solutions', 'sistemas', 'systems', 'global', 'internacional', 'international',
]);

function tokens(s: string): string[] {
  return norm(s)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function tokenScore(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap;
}

/// Pull all candidate accounts once (cheaper than N queries).
export async function loadCandidateAccounts(prisma: PrismaClient): Promise<CandidateAccount[]> {
  return prisma.account.findMany({
    select: { id: true, name: true, domain: true, country: true },
  });
}

/// Heuristic to detect names that are not real companies but generic task
/// titles ("Vender X", "Coordinar...", "Actualización de lista..."). For these
/// we route to a special "Tareas internas" account instead of trying to match.
const GENERIC_TASK_RE = /^(actualizaci[oó]n|actualizar|update|seguimiento|revisar|review|enviar|llamar|preparar|agendar|organizar|crear|obtener|vender|venta|ventas|conseguir|investigar|investigaci[oó]n|coordinar|coordinaci[oó]n|hacer|mandar|cotiz|definir|generar|publicar|comprobar|consultar|validar|analizar|ejecutar|implementar|configurar|cargar|asignar|reasignar|aprobar|firmar|recibir|presentar|gestionar|listar|terminar|finalizar|cerrar|completar|escribir|redactar|comunicar|notificar|recordar|programar|capacitar|entrenar|formar|mostrar|mejorar|optimizar|ajustar|corregir|verificar|depuraci[oó]n|depurar|indagaci[oó]n|indagar|posicionamiento|posicionar|mantener|mantenimiento|campa[ñn]a|reuni[oó]n|meeting|demo|partner|sector|mercado|estrategia|presentaci[oó]n|capacitaci[oó]n|iniciativa|proyecto|dise[ñn]o|gesti[oó]n|tarea)\b/i;

/// Some Asana titles are "Prefix : RealCompany" where the prefix is generic
/// ("Partner : Tata Chile", "Lead : Banco X", "Cliente : Y"). When the prefix
/// matches GENERIC_TASK_RE, we want to use the suffix as the company name.
const GENERIC_PREFIX_SEP = /^(partner|lead|cliente|prospect|prospecto|customer|account|cuenta|deal|opp|oportunidad)\s*[:–—-]\s+(.+)$/i;

export function isGenericTaskName(name: string): boolean {
  return GENERIC_TASK_RE.test(name.trim());
}

/// "Partner : Tata Chile" → "Tata Chile". Returns the trimmed suffix if the
/// prefix is a known generic label, otherwise the original name unchanged.
export function stripGenericPrefix(name: string): string {
  const m = name.trim().match(GENERIC_PREFIX_SEP);
  return m ? m[2].trim() : name;
}

// Domains we should NEVER match against — they're shared/free email providers,
// our internal domains, or third-party tool senders that show up in comments
// without being the prospect (HubSpot/LinkedIn workflow emails, Zoom/Calendly
// meeting links, etc.).
const IGNORE_DOMAINS = new Set([
  // Free email providers
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.mx', 'hotmail.com',
  'outlook.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com',
  'proton.me', 'msn.com', 'mail.com', 'gmx.com',
  // SYSDE / Gurunet internal — these are the senders, not prospects.
  'sysde.com', 'gurunet.biz', 'intergraphicdesigns.com', 'igdonline.com',
  'mobtion.biz', 'whitecobracr.com', 'sysde.cr', 'sysde.mx',
  // SaaS tools that show up as senders in comments but aren't the prospect
  'hubspot.com', 'hsforms.com', 'hsforms.net', 'hubspotemail.net', 'hs-sites.com',
  'linkedin.com', 'lnkd.in', 'realnames.com', 'asana.com', 'asana.net',
  'zoom.us', 'zoom.com', 'calendly.com', 'slack.com', 'salesforce.com',
  'sforce.com', 'mailchimp.com', 'mailgun.com', 'sendgrid.net', 'sendgrid.com',
  'amazonses.com', 'amazonaws.com', 'cloudfront.net', 'github.com', 'github.io',
  'figma.com', 'lovable.dev', 'lovable.app', 'notion.so', 'notion.site',
  'loom.com', 'youtube.com', 'youtu.be', 'vimeo.com', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'whatsapp.com', 'wa.me', 'telegram.org',
  'apple.com', 'icloud.com', 'microsoft.com', 'office.com', 'office365.com',
  'sharepoint.com', 'onedrive.com', 'drive.google.com', 'docs.google.com',
  'google.com', 'gmail.com', 'googleapis.com', 'goog.com', 'goo.gl',
  'wetransfer.com', 'dropbox.com', 'box.com',
]);

/// Pull every email + bare domain we can find in the task's title, notes,
/// custom fields and ALL stories. We use these to widen the dedup search:
/// even if the task title is just "Reunión con Juan", an email like
/// `juan@plazalama.com.do` in a comment lets us reach the right LC account.
function extractTaskDomains(task: AsanaTask): string[] {
  const corpus: string[] = [task.name, task.notes ?? ''];
  for (const f of task.custom_fields ?? []) {
    if (f.display_value) corpus.push(f.display_value);
  }
  for (const s of task.stories ?? []) {
    if (s.text) corpus.push(s.text);
    if (s.created_by?.email) corpus.push(s.created_by.email);
  }
  const text = corpus.join(' ').toLowerCase();

  const out = new Set<string>();
  // Email addresses → take the domain part
  for (const m of text.matchAll(/\b[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi)) {
    const dom = m[1].toLowerCase();
    if (!IGNORE_DOMAINS.has(dom)) out.add(dom);
  }
  // Bare domains (URLs without protocol)
  for (const m of text.matchAll(/\b([a-z0-9-]+(?:\.[a-z0-9-]+){1,2})\.(com|com\.[a-z]{2,3}|org|net|co|mx|cr|sv|gt|hn|ni|pa|do|pe|cl|ec|co\.[a-z]{2,3}|biz|info|app|dev|io|gob|gov)\b/gi)) {
    const dom = (m[1] + '.' + m[2]).toLowerCase();
    if (!IGNORE_DOMAINS.has(dom)) out.add(dom);
  }
  return [...out];
}

/// Best dedup match for one Asana task. Returns 'skip' when no acceptable
/// match exists — per user policy we DON'T create new accounts; only the
/// shared __ASANA_GENERIC__ bucket is materialized for template-style tasks.
function findMatch(
  task: AsanaTask,
  companyName: string,
  candidates: CandidateAccount[],
  candidatesByDomain: Map<string, CandidateAccount>
): DedupAction {
  const target = norm(companyName);
  if (!target) {
    // Generic template — bucket-route.
    if (isGenericTaskName(task.name)) return { type: 'create', companyName: '__ASANA_GENERIC__' };
    return { type: 'skip', reason: 'empty company name' };
  }

  // Generic task names (no company in the title) → route to a special bucket.
  if (isGenericTaskName(companyName)) {
    return { type: 'create', companyName: '__ASANA_GENERIC__' };
  }

  // 1. Exact match (normalised). Country match boosts confidence but isn't
  //    required — companies sometimes have different country labels in the
  //    two systems for regional offices.
  const exact = candidates.find((c) => norm(c.name) === target);
  if (exact) {
    return { type: 'reuse', accountId: exact.id, matchedBy: 'exact', accountName: exact.name, confidence: 1 };
  }

  // 2. Token overlap. Accept if 2+ distinctive tokens overlap. We removed
  //    the single-token boost (it was producing too many false positives
  //    via shared geographic markers like "México" or "Costa Rica").
  const targetTokens = tokens(companyName);
  let best: { acc: CandidateAccount; score: number } | null = null;
  for (const c of candidates) {
    const score = tokenScore(companyName, c.name);
    // Require at least 2 distinctive tokens overlap. If the target has 1
    // token, we only accept if the candidate's name is very close (the
    // exact-match branch above already covers that, so we don't try here).
    if (score >= 2 && (!best || score > best.score)) best = { acc: c, score };
  }
  if (best && best.score >= 2) {
    return { type: 'reuse', accountId: best.acc.id, matchedBy: 'tokens', accountName: best.acc.name, confidence: 0.8 };
  }

  // 3. Domain match — try EVERY domain we can mine from the task's notes,
  //    custom fields, comments and commenter emails.
  const taskDomains = extractTaskDomains(task);
  for (const dom of taskDomains) {
    if (IGNORE_DOMAINS.has(dom)) continue;
    const hit = candidatesByDomain.get(dom);
    if (hit) {
      return { type: 'reuse', accountId: hit.id, matchedBy: 'domain', accountName: hit.name, confidence: 0.9 };
    }
    // Try parent domain (e.g. "email.hubspot.com" → "hubspot.com"). MUST also
    // check IGNORE_DOMAINS on the parent — otherwise email senders from
    // SaaS platforms (HubSpot/LinkedIn/Asana notifications) all leak through.
    const parts = dom.split('.');
    if (parts.length > 2) {
      // 2-level parent (most common): "x.y.com" → "y.com"
      const parent2 = parts.slice(-2).join('.');
      if (!IGNORE_DOMAINS.has(parent2)) {
        const hit2 = candidatesByDomain.get(parent2);
        if (hit2) {
          return { type: 'reuse', accountId: hit2.id, matchedBy: 'email-domain', accountName: hit2.name, confidence: 0.85 };
        }
      }
      // 3-level parent for ccTLDs like "y.com.mx", "x.co.cr"
      if (parts.length > 3) {
        const parent3 = parts.slice(-3).join('.');
        if (!IGNORE_DOMAINS.has(parent3)) {
          const hit3 = candidatesByDomain.get(parent3);
          if (hit3) {
            return { type: 'reuse', accountId: hit3.id, matchedBy: 'email-domain', accountName: hit3.name, confidence: 0.85 };
          }
        }
      }
    }
  }

  // No match anywhere → skip (don't create a new account).
  return { type: 'skip', reason: 'no LC account match (name/tokens/domain)' };
}

/// Build the full plan for a list of Asana tasks. Dedup is per task (we no
/// longer cache by company name) because we now mine task-specific signals
/// (emails in stories, domains in notes) — so two tasks with the same
/// generic title can land on different real accounts.
export function buildPlan(
  tasks: AsanaTask[],
  candidates: CandidateAccount[]
): { plan: DedupPlan[]; summary: PlanSummary } {
  // Build a fast lookup: domain → account
  const candidatesByDomain = new Map<string, CandidateAccount>();
  for (const c of candidates) {
    if (c.domain) candidatesByDomain.set(c.domain.toLowerCase(), c);
  }

  const plan: DedupPlan[] = [];
  for (const task of tasks) {
    let companyName = extractCompanyName(task.name);
    // If the title starts with a known generic prefix ("Partner :", "Lead :"),
    // use the part AFTER the colon as the real company name.
    companyName = stripGenericPrefix(companyName);
    const action = findMatch(task, companyName, candidates, candidatesByDomain);

    let groupKey: string;
    if (action.type === 'reuse') groupKey = action.accountId;
    else if (action.type === 'create') groupKey = '__generic__';
    else groupKey = `skip:${task.gid}`;

    plan.push({
      taskGid: task.gid,
      asanaName: task.name,
      companyName,
      action,
      groupKey,
    });
  }

  const summary = summarize(plan);
  return { plan, summary };
}

export interface PlanSummary {
  totalTasks: number;
  uniqueCompanies: number;
  reuseExact: number;
  reuseTokens: number;
  reuseDomain: number;
  reuseEmailDomain: number;
  bucketedGeneric: number;
  skipped: number;
  /// Companies (by groupKey) that have multiple Asana tasks → multiple opps.
  companiesWithMultipleOpps: Array<{ groupKey: string; companyName: string; count: number; accountName?: string }>;
  /// Sample of skipped task names so the user can spot-check.
  skippedSample: Array<{ companyName: string; asanaName: string; reason: string }>;
}

function summarize(plan: DedupPlan[]): PlanSummary {
  const companies = new Map<string, { name: string; count: number; accountName?: string }>();
  let reuseExact = 0, reuseTokens = 0, reuseDomain = 0, reuseEmailDomain = 0;
  let bucketedGeneric = 0, skipped = 0;
  const skippedSample: PlanSummary['skippedSample'] = [];

  for (const p of plan) {
    const existing = companies.get(p.groupKey);
    const accountName = p.action.type === 'reuse' ? p.action.accountName
      : p.action.type === 'create' ? '[Bucket] Asana - Tareas internas'
      : undefined;
    const displayName = p.groupKey === '__generic__' ? '[Tareas internas — bucket compartido]' : p.companyName;
    if (existing) existing.count++;
    else companies.set(p.groupKey, { name: displayName, count: 1, accountName });

    if (p.action.type === 'reuse') {
      if (p.action.matchedBy === 'exact') reuseExact++;
      else if (p.action.matchedBy === 'tokens') reuseTokens++;
      else if (p.action.matchedBy === 'domain') reuseDomain++;
      else if (p.action.matchedBy === 'email-domain') reuseEmailDomain++;
    } else if (p.action.type === 'create') {
      bucketedGeneric++;
    } else {
      skipped++;
      if (skippedSample.length < 30) {
        skippedSample.push({ companyName: p.companyName, asanaName: p.asanaName, reason: p.action.reason });
      }
    }
  }
  const multi = [...companies.entries()]
    .filter(([k, v]) => v.count > 1 && !k.startsWith('skip:'))
    .map(([groupKey, v]) => ({ groupKey, companyName: v.name, count: v.count, accountName: v.accountName }))
    .sort((a, b) => b.count - a.count);

  return {
    totalTasks: plan.length,
    uniqueCompanies: companies.size,
    reuseExact,
    reuseTokens,
    reuseDomain,
    reuseEmailDomain,
    bucketedGeneric,
    skipped,
    companiesWithMultipleOpps: multi,
    skippedSample,
  };
}
