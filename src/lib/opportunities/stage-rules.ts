import { OpportunityStage } from '@prisma/client';

export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  LEAD: 5,
  DISCOVERY: 15,
  SIZING: 25,
  DEMO: 40,
  PROPOSAL: 60,
  NEGOTIATION: 75,
  CLOSING: 90,
  HANDOFF: 95,
  WON: 100,
  LOST: 0,
  STAND_BY: 10,
  NURTURE: 5,
};

export const PIPELINE_STAGES: OpportunityStage[] = [
  'LEAD',
  'DISCOVERY',
  'SIZING',
  'DEMO',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSING',
  'HANDOFF',
  'WON',
];

export function isStageTransitionValid(
  _from: OpportunityStage,
  _to: OpportunityStage
): boolean {
  return true;
}

export type StageRequirementField =
  | 'portfolioAmount'
  | 'userCount'
  | 'annualOperations'
  | 'contactRoles'
  | 'estimatedValue'
  | 'commercialModel'
  | 'expectedCloseDate';

export function getStageRequirements(stage: OpportunityStage): StageRequirementField[] {
  const req: Partial<Record<OpportunityStage, StageRequirementField[]>> = {
    SIZING: ['portfolioAmount', 'userCount', 'annualOperations'],
    DEMO: ['contactRoles', 'estimatedValue'],
    PROPOSAL: ['commercialModel', 'expectedCloseDate', 'estimatedValue'],
    NEGOTIATION: ['estimatedValue', 'expectedCloseDate'],
    CLOSING: ['estimatedValue', 'expectedCloseDate', 'commercialModel'],
  };
  return req[stage] ?? [];
}

export const REQUIREMENT_LABELS: Record<StageRequirementField, string> = {
  portfolioAmount: 'Monto de cartera',
  userCount: 'Cantidad de usuarios',
  annualOperations: 'Operaciones anuales',
  contactRoles: 'Al menos un contacto vinculado',
  estimatedValue: 'Valor estimado',
  commercialModel: 'Modelo comercial',
  expectedCloseDate: 'Fecha de cierre esperada',
};
