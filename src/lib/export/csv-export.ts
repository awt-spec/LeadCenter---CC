import Papa from 'papaparse';

export type ExportableContact = {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  companyName: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  mobilePhone: string | null;
  linkedinUrl: string | null;
  website: string | null;
  source: string;
  sourceDetail: string | null;
  status: string;
  marketSegment: string | null;
  productInterest: string[];
  owner: { name: string; email: string } | null;
  tags: string[];
  optIn: boolean;
  notes: string | null;
  createdAt: Date;
};

export function contactsToCsvString(rows: ExportableContact[]): string {
  const records = rows.map((c) => ({
    email: c.email,
    first_name: c.firstName,
    last_name: c.lastName,
    job_title: c.jobTitle ?? '',
    company_name: c.companyName ?? '',
    country: c.country ?? '',
    city: c.city ?? '',
    phone: c.phone ?? '',
    mobile_phone: c.mobilePhone ?? '',
    linkedin_url: c.linkedinUrl ?? '',
    website: c.website ?? '',
    source: c.source,
    source_detail: c.sourceDetail ?? '',
    status: c.status,
    market_segment: c.marketSegment ?? '',
    product_interest: c.productInterest.join(';'),
    owner_name: c.owner?.name ?? '',
    owner_email: c.owner?.email ?? '',
    tags: c.tags.join(';'),
    opt_in: c.optIn ? 'yes' : 'no',
    notes: c.notes ?? '',
    created_at: c.createdAt.toISOString(),
  }));

  return Papa.unparse(records);
}

export type ExportableAccount = {
  name: string;
  legalName: string | null;
  domain: string | null;
  website: string | null;
  segment: string | null;
  industry: string | null;
  size: string;
  employeeCount: number | null;
  annualRevenue: number | null;
  currency: string;
  country: string | null;
  region: string | null;
  city: string | null;
  status: string;
  priority: string;
  ownerName: string | null;
  ownerEmail: string | null;
  contactsCount: number;
  opportunitiesCount: number;
  pipelineTotal: number;
  description: string | null;
  createdAt: Date;
};

export function accountsToCsvString(rows: ExportableAccount[]): string {
  const records = rows.map((a) => ({
    name: a.name,
    legal_name: a.legalName ?? '',
    domain: a.domain ?? '',
    website: a.website ?? '',
    segment: a.segment ?? '',
    industry: a.industry ?? '',
    size: a.size,
    employees: a.employeeCount ?? '',
    annual_revenue: a.annualRevenue ?? '',
    currency: a.currency,
    country: a.country ?? '',
    region: a.region ?? '',
    city: a.city ?? '',
    status: a.status,
    priority: a.priority,
    owner_name: a.ownerName ?? '',
    owner_email: a.ownerEmail ?? '',
    contacts_count: a.contactsCount,
    opportunities_count: a.opportunitiesCount,
    pipeline_total: a.pipelineTotal,
    description: a.description ?? '',
    created_at: a.createdAt.toISOString(),
  }));
  return Papa.unparse(records);
}

export type ExportableOpportunity = {
  code: string | null;
  name: string;
  accountName: string;
  product: string;
  subProduct: string | null;
  stage: string;
  status: string;
  rating: string;
  probability: number;
  estimatedValue: number | null;
  currency: string;
  commercialModel: string;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  ownerName: string | null;
  ownerEmail: string | null;
  source: string;
  lostReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function opportunitiesToCsvString(rows: ExportableOpportunity[]): string {
  const records = rows.map((o) => ({
    code: o.code ?? '',
    name: o.name,
    account: o.accountName,
    product: o.product,
    sub_product: o.subProduct ?? '',
    stage: o.stage,
    status: o.status,
    rating: o.rating,
    probability: o.probability,
    estimated_value: o.estimatedValue ?? '',
    currency: o.currency,
    commercial_model: o.commercialModel,
    expected_close: o.expectedCloseDate ? o.expectedCloseDate.toISOString().slice(0, 10) : '',
    closed_at: o.closedAt ? o.closedAt.toISOString().slice(0, 10) : '',
    owner_name: o.ownerName ?? '',
    owner_email: o.ownerEmail ?? '',
    source: o.source,
    lost_reason: o.lostReason ?? '',
    created_at: o.createdAt.toISOString(),
    updated_at: o.updatedAt.toISOString(),
  }));
  return Papa.unparse(records);
}

export function triggerCsvDownload(csv: string, filenamePrefix = 'contactos-sysde') {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
