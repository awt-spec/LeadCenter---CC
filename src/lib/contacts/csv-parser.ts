import Papa from 'papaparse';

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

export async function parseCsvFile(file: File, preview = 0): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      preview: preview > 0 ? preview : undefined,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter(Boolean);
        resolve({
          headers,
          rows: results.data ?? [],
          totalRows: (results.data ?? []).length,
        });
      },
      error: (err) => reject(err),
    });
  });
}

export function downloadTemplate() {
  const headers = [
    'email',
    'first_name',
    'last_name',
    'company_name',
    'job_title',
    'country',
    'phone',
    'linkedin_url',
    'source',
  ];
  const sample =
    'jdoe@example.com,John,Doe,Acme Inc,Director de Operaciones,México,+52 55 1234 5678,https://linkedin.com/in/jdoe,LINKEDIN_OUTBOUND';
  const csv = [headers.join(','), sample].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-contactos-sysde.csv';
  a.click();
  URL.revokeObjectURL(url);
}
