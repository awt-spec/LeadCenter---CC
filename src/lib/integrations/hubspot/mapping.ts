// Pure functions that map HubSpot CRM payloads to LeadCenter Prisma input shapes.
// Kept pure (no DB access) so they're easy to unit test.

import type { Prisma, OpportunityStage, OpportunityStatus, ContactStatus, AccountStatus, AccountPriority } from '@prisma/client';
import { HUBSPOT_STAGE_ID_TO_LC } from '@/lib/shared/labels';

type HsProps = Record<string, string | null>;

// ===== Companies → Accounts =====

export function mapCompanyToAccount(props: HsProps, importerUserId: string): Prisma.AccountUncheckedCreateInput {
  const name = (props.name ?? props.domain ?? 'Sin nombre').toString().slice(0, 200);
  const domain = props.domain?.toString().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/g, '') ?? null;
  const status: AccountStatus = pickAccountStatus(props.lifecyclestage ?? null);
  const priority: AccountPriority = 'NORMAL';
  return {
    name,
    domain: domain || null,
    legalName: props.legalname ?? null,
    website: props.website ?? null,
    industry: props.industry ?? null,
    country: props.country ?? null,
    city: props.city ?? null,
    address: props.address ?? null,
    description: props.description ?? null,
    status,
    priority,
    createdById: importerUserId,
    // Default owner = the user who connected HubSpot. They can reassign
    // manually via bulk actions later. Without this, new accounts arrive
    // with no owner and don't show up in "my accounts" filters.
    ownerId: importerUserId,
  };
}

function pickAccountStatus(lifecycle: string | null): AccountStatus {
  switch ((lifecycle ?? '').toLowerCase()) {
    case 'customer':
      return 'CUSTOMER';
    case 'evangelist':
    case 'opportunity':
    case 'salesqualifiedlead':
    case 'marketingqualifiedlead':
      return 'ACTIVE';
    case 'lead':
    case 'subscriber':
      return 'PROSPECT';
    case 'other':
      return 'INACTIVE';
    default:
      return 'PROSPECT';
  }
}

// ===== Contacts → Contacts =====

export function mapContactToContact(
  props: HsProps,
  accountId: string | null,
  importerUserId: string
): Prisma.ContactUncheckedCreateInput | null {
  const email = (props.email ?? '').toString().trim().toLowerCase();
  if (!email) return null;
  const fullName = (`${props.firstname ?? ''} ${props.lastname ?? ''}`.trim() || email).slice(0, 200);
  return {
    email,
    firstName: (props.firstname ?? fullName.split(' ')[0] ?? '—').slice(0, 100),
    lastName: (props.lastname ?? fullName.split(' ').slice(1).join(' ') ?? '—').slice(0, 100) || '—',
    fullName,
    jobTitle: props.jobtitle ?? null,
    phone: props.phone ?? null,
    mobilePhone: props.mobilephone ?? null,
    linkedinUrl: props.hs_linkedin_url ?? null,
    website: props.website ?? null,
    country: props.country ?? null,
    city: props.city ?? null,
    companyName: props.company ?? null,
    accountId: accountId ?? null,
    source: 'CSV_IMPORT',
    sourceDetail: 'HubSpot sync',
    status: pickContactStatus(props.hs_lead_status ?? null),
    createdById: importerUserId,
  };
}

function pickContactStatus(s: string | null): ContactStatus {
  switch ((s ?? '').toLowerCase()) {
    case 'open':
    case 'in_progress':
    case 'connected':
      return 'ACTIVE';
    case 'attempted_to_contact':
    case 'unqualified':
      return 'COLD';
    default:
      return 'NURTURE';
  }
}

// ===== Deals → Opportunities =====

export function mapDealToOpportunity(
  props: HsProps,
  accountId: string,
  importerUserId: string,
  pipelineLabelByStageId: Map<string, { label: string; probability: number }>
): Prisma.OpportunityUncheckedCreateInput {
  const stageInfo = pipelineLabelByStageId.get(String(props.dealstage ?? ''));
  // Prefer exact id match against the SYSDE pipelines (Pipeline de ventas
  // + Pipeline EW). Fall back to label-based heuristics for unknown ids.
  const stageById = HUBSPOT_STAGE_ID_TO_LC[String(props.dealstage ?? '')];
  const stage = stageById ?? pickOppStage(stageInfo?.label ?? props.dealstage ?? null);
  const status: OpportunityStatus = stage === 'WON' ? 'WON' : stage === 'LOST' ? 'LOST' : 'OPEN';
  const amount = props.amount ? Number(props.amount) : null;
  const probability = Number.isFinite(stageInfo?.probability) ? stageInfo!.probability : oppProb(stage);
  const closeDate = props.closedate ? new Date(props.closedate) : null;
  return {
    name: (props.dealname ?? 'Deal sin nombre').toString().slice(0, 200),
    description: props.description ?? null,
    accountId,
    stage,
    status,
    rating: 'UNSCORED',
    product: 'CUSTOM',
    subProduct: 'NONE',
    estimatedValue: amount !== null && Number.isFinite(amount) ? amount : null,
    currency: (props.deal_currency_code ?? 'USD').toString().slice(0, 3),
    probability,
    expectedCloseDate: closeDate && !Number.isNaN(closeDate.getTime()) ? closeDate : null,
    commercialModel: 'UNDEFINED',
    source: 'UNKNOWN',
    isDirectProspecting: false,
    createdById: importerUserId,
  };
}

function pickOppStage(label: string | null): OpportunityStage {
  const s = (label ?? '').toLowerCase();
  if (s.includes('won') || s.includes('ganad')) return 'WON';
  if (s.includes('lost') || s.includes('perd')) return 'LOST';
  if (s.includes('closing') || s.includes('cierre')) return 'CLOSING';
  if (s.includes('negotiat') || s.includes('negociac')) return 'NEGOTIATION';
  if (s.includes('proposal') || s.includes('propuesta') || s.includes('contract')) return 'PROPOSAL';
  if (s.includes('demo') || s.includes('present')) return 'DEMO';
  if (s.includes('siz') || s.includes('dimension')) return 'SIZING';
  if (s.includes('discov') || s.includes('descub') || s.includes('qualif')) return 'DISCOVERY';
  if (s.includes('appointment') || s.includes('cita')) return 'DISCOVERY';
  return 'LEAD';
}

// ===== Emails → Activity =====

/// Properties we ask HubSpot for. Tracking metadata (opens/clicks/replies)
/// comes alongside the email body — no separate scope needed beyond
/// sales-email-read.
export const HS_EMAIL_PROPS = [
  // Body
  'hs_email_subject', 'hs_email_text', 'hs_email_html', 'hs_body_preview',
  // Direction + status
  'hs_email_direction', 'hs_email_status', 'hs_email_to_email', 'hs_email_from_email',
  // Timestamps
  'hs_timestamp', 'hs_email_send_at', 'hs_createdate', 'hs_lastmodifieddate',
  // Tracking — opens / clicks / replies
  'hs_email_open_count', 'hs_email_last_open_date',
  'hs_email_click_count', 'hs_email_last_click_date',
  'hs_email_reply_count', 'hs_email_last_reply_date',
  'hs_email_bounce_count',
];

export function mapEmailToActivity(
  props: HsProps,
  contactId: string | null,
  accountId: string | null,
  opportunityId: string | null,
  importerUserId: string
): Prisma.ActivityUncheckedCreateInput | null {
  const subject = (props.hs_email_subject ?? '(sin asunto)').toString().slice(0, 250);
  const bodyText = (props.hs_email_text ?? props.hs_email_html ?? props.hs_body_preview ?? '')
    .toString()
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);
  const ts = props.hs_timestamp ?? props.hs_email_send_at ?? props.hs_createdate;
  const occurredAt = ts ? new Date(ts) : new Date();
  if (Number.isNaN(occurredAt.getTime())) return null;

  const direction = (props.hs_email_direction ?? 'EMAIL').toString().toUpperCase();
  // Outbound: 'EMAIL', 'FORWARDED_EMAIL', 'REPLY_EMAIL' (sent by us).
  // Inbound:  'INCOMING_EMAIL'.
  const type: 'EMAIL_SENT' | 'EMAIL_RECEIVED' = direction === 'INCOMING_EMAIL' ? 'EMAIL_RECEIVED' : 'EMAIL_SENT';

  // Pull tracking counts. HubSpot returns them as strings ("3") or null.
  const num = (s: string | null | undefined): number | null => {
    if (s === null || s === undefined || s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const dateOrNull = (s: string | null | undefined): string | null => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const tracking = {
    openCount: num(props.hs_email_open_count) ?? 0,
    lastOpenedAt: dateOrNull(props.hs_email_last_open_date),
    clickCount: num(props.hs_email_click_count) ?? 0,
    lastClickedAt: dateOrNull(props.hs_email_last_click_date),
    replyCount: num(props.hs_email_reply_count) ?? 0,
    lastRepliedAt: dateOrNull(props.hs_email_last_reply_date),
    bounceCount: num(props.hs_email_bounce_count) ?? 0,
    status: props.hs_email_status?.toString() ?? null,
    to: props.hs_email_to_email?.toString() ?? null,
    from: props.hs_email_from_email?.toString() ?? null,
  };

  return {
    type,
    subject,
    bodyText: bodyText || null,
    // NOTE: tag the JSON shape so the UI doesn't try to render it as a
    // Tiptap document (BodyRenderer expects tiptap JSON). The card has a
    // dedicated branch for type='hs_email' that shows the tracking badges.
    bodyJson: { type: 'hs_email', tracking } as Prisma.InputJsonValue,
    occurredAt,
    contactId,
    accountId,
    opportunityId,
    createdById: importerUserId,
  };
}

function oppProb(stage: OpportunityStage): number {
  switch (stage) {
    case 'WON': return 100;
    case 'LOST': return 0;
    case 'CLOSING': return 90;
    case 'NEGOTIATION': return 75;
    case 'PROPOSAL': return 60;
    case 'DEMO': return 40;
    case 'SIZING': return 25;
    case 'DISCOVERY': return 15;
    case 'STAND_BY':
    case 'NURTURE':
    case 'HANDOFF':
    default: return 5;
  }
}
