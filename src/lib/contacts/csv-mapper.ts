import type { ImportFieldKey } from './schemas';

const MAPPING_RULES: Record<ImportFieldKey, RegExp[]> = {
  email: [/^e-?mail/i, /correo/i],
  firstName: [/^(first[\s_-]?name|nombre|given[\s_-]?name|prenom)$/i, /^name$/i],
  lastName: [/^(last[\s_-]?name|apellidos?|surname|family[\s_-]?name)/i],
  companyName: [/company/i, /empresa/i, /organisation|organization/i, /account[\s_-]?name/i],
  jobTitle: [/^(job[\s_-]?title|cargo|puesto|title|position)/i],
  seniorityLevel: [/^(seniority|nivel|level)/i],
  country: [/^(country|pa[íi]s|country[\s_-]?name)/i],
  city: [/^(city|ciudad|town)/i],
  phone: [/^(phone|tel[eé]fono|phone[\s_-]?number)/i, /office.*phone/i],
  mobilePhone: [/mobile|celular|cell/i],
  linkedinUrl: [/linkedin/i],
  website: [/^(website|web|url|sitio)/i],
  source: [/^(source|origen|lead[\s_-]?source)/i],
  sourceDetail: [/^(source[\s_-]?detail|campa[ñn]a|campaign)/i],
  marketSegment: [/^(segment|segmento|industry|industria|market)/i],
  notes: [/^(notes?|notas?|comments?|comentarios?)/i],
  tags: [/^(tags?|etiquetas?|labels?)/i],
};

export function autoDetectMapping(headers: string[]): Record<string, ImportFieldKey | 'ignore'> {
  const mapping: Record<string, ImportFieldKey | 'ignore'> = {};
  const used = new Set<ImportFieldKey>();

  for (const header of headers) {
    const cleaned = header.trim();
    let matched: ImportFieldKey | 'ignore' = 'ignore';
    for (const [field, patterns] of Object.entries(MAPPING_RULES) as [
      ImportFieldKey,
      RegExp[]
    ][]) {
      if (used.has(field)) continue;
      if (patterns.some((re) => re.test(cleaned))) {
        matched = field;
        used.add(field);
        break;
      }
    }
    mapping[cleaned] = matched;
  }

  return mapping;
}
