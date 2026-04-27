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
