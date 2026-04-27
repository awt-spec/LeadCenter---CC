'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, FileText, Download, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TagPicker } from './tag-picker';
import { cn } from '@/lib/utils';
import { parseCsvFile, downloadTemplate, type ParsedCsv } from '@/lib/contacts/csv-parser';
import { autoDetectMapping } from '@/lib/contacts/csv-mapper';
import { IMPORT_FIELD_KEYS, REQUIRED_IMPORT_FIELDS, type ImportFieldKey } from '@/lib/contacts/schemas';
import { processImport } from '@/lib/contacts/mutations';
import { CONTACT_SOURCE_LABELS, CONTACT_STATUS_LABELS } from '@/lib/constants';

type UserLite = { id: string; name: string };
type TagLite = { id: string; name: string; color: string };

type Step = 'upload' | 'mapping' | 'options' | 'processing';

const MAX_SIZE = 50 * 1024 * 1024;
const IGNORE_VALUE = '__ignore__';

const FIELD_LABELS: Record<ImportFieldKey | 'ignore', string> = {
  email: 'Email *',
  firstName: 'Nombre *',
  lastName: 'Apellido *',
  companyName: 'Empresa',
  jobTitle: 'Cargo',
  seniorityLevel: 'Seniority',
  country: 'País',
  city: 'Ciudad',
  phone: 'Teléfono',
  mobilePhone: 'Móvil',
  linkedinUrl: 'LinkedIn',
  website: 'Sitio web',
  source: 'Source',
  sourceDetail: 'Source detail',
  marketSegment: 'Segmento',
  notes: 'Notas',
  tags: 'Tags (separados por coma)',
  ignore: '— Ignorar —',
};

export function ImportWizard({
  users,
  tags,
  currentUserId,
}: {
  users: UserLite[];
  tags: TagLite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, ImportFieldKey | 'ignore'>>({});
  const [dedupe, setDedupe] = useState<'SKIP' | 'UPDATE' | 'CREATE_NEW'>('SKIP');
  const [defaultOwnerId, setDefaultOwnerId] = useState<string>(currentUserId);
  const [defaultSource, setDefaultSource] = useState<string>('CSV_IMPORT');
  const [defaultStatus, setDefaultStatus] = useState<string>('ACTIVE');
  const [applyTagIds, setApplyTagIds] = useState<string[]>([]);
  const [markOptIn, setMarkOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
    maxSize: MAX_SIZE,
    onDrop: async (accepted, rejected) => {
      if (rejected.length) {
        toast.error('Archivo rechazado. Verifica formato (.csv) y tamaño (< 50MB).');
        return;
      }
      const f = accepted[0];
      if (!f) return;
      setFile(f);
      try {
        const p = await parseCsvFile(f);
        if (!p.rows.length) {
          toast.error('El archivo está vacío.');
          return;
        }
        setParsed(p);
        setMapping(autoDetectMapping(p.headers));
      } catch (err) {
        toast.error('Error al leer el CSV');
        console.error(err);
      }
    },
  });

  const canContinueFromMapping = () => {
    const mapped = new Set(Object.values(mapping));
    return REQUIRED_IMPORT_FIELDS.every((f) => mapped.has(f));
  };

  async function handleSubmit() {
    if (!file || !parsed) return;
    setSubmitting(true);
    setStep('processing');

    const cleanMapping: Record<string, string> = {};
    for (const [col, field] of Object.entries(mapping)) {
      cleanMapping[col] = field === 'ignore' ? 'ignore' : field;
    }

    const res = await processImport({
      fileName: file.name,
      fileSize: file.size,
      columnMapping: cleanMapping,
      dedupeStrategy: dedupe,
      defaultOwnerId,
      defaultSource: defaultSource as never,
      defaultStatus: defaultStatus as never,
      applyTagIds,
      markOptIn,
      rows: parsed.rows,
    });

    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      setStep('options');
      return;
    }

    toast.success('Importación completada');
    router.push(`/contacts/import/${res.data.batchId}`);
    router.refresh();
  }

  return (
    <div>
      <Stepper step={step} />

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 1: Sube tu archivo CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                isDragActive
                  ? 'border-sysde-red bg-sysde-red-light'
                  : 'border-sysde-border bg-sysde-bg hover:border-sysde-red/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mb-3 h-10 w-10 text-sysde-mid" />
              <p className="text-sm font-medium text-sysde-gray">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu CSV o haz click para seleccionar'}
              </p>
              <p className="mt-1 text-xs text-sysde-mid">
                Formatos aceptados: .csv · Máximo 50MB
              </p>
            </div>

            {file && parsed && (
              <div className="flex items-center justify-between rounded-lg border border-sysde-border bg-white p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-sysde-red" />
                  <div>
                    <div className="text-sm font-medium text-sysde-gray">{file.name}</div>
                    <div className="text-xs text-sysde-mid">
                      {(file.size / 1024).toFixed(1)} KB · {parsed.rows.length} filas · {parsed.headers.length} columnas
                    </div>
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="mr-1.5 h-4 w-4" />
                Descargar plantilla CSV
              </Button>
              <Button onClick={() => setStep('mapping')} disabled={!parsed}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && parsed && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 2: Mapea las columnas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-sysde-mid">
              Asocia cada columna del CSV con un campo del sistema. Los campos con * son obligatorios.
            </p>

            <div className="overflow-hidden rounded-lg border border-sysde-border">
              <Table>
                <TableHeader className="bg-sysde-bg">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Columna del CSV</TableHead>
                    <TableHead>Primer valor de ejemplo</TableHead>
                    <TableHead>Campo del sistema</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.headers.map((header) => (
                    <TableRow key={header} className="hover:bg-transparent">
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell className="text-sysde-mid">
                        {parsed.rows[0]?.[header] || '—'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[header] ?? IGNORE_VALUE}
                          onValueChange={(v) =>
                            setMapping((prev) => ({
                              ...prev,
                              [header]: v === IGNORE_VALUE ? 'ignore' : (v as ImportFieldKey),
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORE_VALUE}>— Ignorar —</SelectItem>
                            {IMPORT_FIELD_KEYS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {FIELD_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-sysde-gray">
                Preview de los primeros 5 registros
              </h4>
              <div className="overflow-x-auto rounded-lg border border-sysde-border">
                <Table>
                  <TableHeader className="bg-sysde-bg">
                    <TableRow className="hover:bg-transparent">
                      {Object.entries(mapping)
                        .filter(([, v]) => v !== 'ignore')
                        .map(([col, field]) => (
                          <TableHead key={col} className="whitespace-nowrap">
                            {FIELD_LABELS[field]}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        {Object.entries(mapping)
                          .filter(([, v]) => v !== 'ignore')
                          .map(([col]) => (
                            <TableCell key={col} className="whitespace-nowrap text-sysde-gray">
                              {row[col] || '—'}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {!canContinueFromMapping() && (
              <p className="text-xs text-danger">
                Debes mapear al menos email, nombre y apellido para continuar.
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Atrás
              </Button>
              <Button onClick={() => setStep('options')} disabled={!canContinueFromMapping()}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'options' && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 3: Opciones y valores por defecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Estrategia de deduplicación</Label>
              <div className="space-y-2">
                {(
                  [
                    { v: 'SKIP', label: 'Saltar duplicados', desc: 'Si el email ya existe, ignorar la fila (recomendado).' },
                    { v: 'UPDATE', label: 'Actualizar existentes', desc: 'Si el email ya existe, actualizar con datos del CSV.' },
                    { v: 'CREATE_NEW', label: 'Crear de todas formas', desc: 'No se permitirán emails duplicados por restricción única.', warn: true },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.v}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      dedupe === opt.v
                        ? 'border-sysde-red bg-sysde-red-light'
                        : 'border-sysde-border bg-white hover:border-sysde-red/30'
                    )}
                  >
                    <input
                      type="radio"
                      className="mt-1 accent-sysde-red"
                      checked={dedupe === opt.v}
                      onChange={() => setDedupe(opt.v)}
                    />
                    <div>
                      <div className="text-sm font-medium text-sysde-gray">{opt.label}</div>
                      <div className="text-xs text-sysde-mid">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Owner por defecto</Label>
                <Select value={defaultOwnerId} onValueChange={setDefaultOwnerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source por defecto</Label>
                <Select value={defaultSource} onValueChange={setDefaultSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_SOURCE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status por defecto</Label>
                <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags a aplicar a todos los contactos importados</Label>
              <TagPicker tags={tags} value={applyTagIds} onChange={setApplyTagIds} />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-warning/30 bg-amber-50 p-3">
              <Checkbox
                checked={markOptIn}
                onCheckedChange={(v) => setMarkOptIn(!!v)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-sysde-gray">
                  Marcar opt-in en todos los contactos importados
                </div>
                <div className="text-xs text-sysde-mid">
                  Solo activa esta opción si tienes evidencia de consentimiento explícito (GDPR). De lo contrario, déjala desmarcada.
                </div>
              </div>
            </label>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Atrás
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Importando…' : 'Iniciar importación'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'processing' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-sysde-border border-t-sysde-red" />
            <div className="text-center">
              <div className="text-lg font-semibold text-sysde-gray">Procesando importación…</div>
              <div className="mt-1 text-sm text-sysde-mid">
                Esto puede tardar unos segundos dependiendo del tamaño del archivo.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: '1. Subir' },
    { key: 'mapping', label: '2. Mapear' },
    { key: 'options', label: '3. Opciones' },
    { key: 'processing', label: '4. Procesar' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 min-w-[32px] items-center rounded-full px-3 text-xs font-medium transition-colors',
              i < currentIdx && 'bg-sysde-red text-white',
              i === currentIdx && 'bg-sysde-red-light text-sysde-red',
              i > currentIdx && 'bg-neutral-100 text-sysde-mid'
            )}
          >
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="h-px w-8 bg-sysde-border" />}
        </div>
      ))}
    </div>
  );
}
