import 'server-only';
import { prisma } from '@/lib/db';
import type { CustomFieldEntity } from './schemas';

export async function listCustomFields(entity: CustomFieldEntity) {
  return prisma.customFieldDefinition.findMany({
    where: { entity },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getCustomFieldsForRecord(
  entity: CustomFieldEntity,
  recordId: string
) {
  const definitions = await listCustomFields(entity);
  if (definitions.length === 0) return { definitions: [], values: [] };

  const where =
    entity === 'CONTACT'
      ? { contactId: recordId }
      : entity === 'ACCOUNT'
      ? { accountId: recordId }
      : { opportunityId: recordId };

  const values = await prisma.customFieldValue.findMany({
    where,
    select: { fieldId: true, value: true },
  });

  return { definitions, values };
}
