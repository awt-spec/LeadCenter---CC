import type { OpportunityStage, OpportunityStatus } from '@prisma/client';
import { STAGE_PROBABILITY } from './stage-rules';

export function computeStatusAndProbability(
  toStage: OpportunityStage,
  currentProbability: number
): { status: OpportunityStatus; probability: number } {
  const probability = STAGE_PROBABILITY[toStage];
  if (toStage === 'WON') return { status: 'WON', probability: 100 };
  if (toStage === 'LOST') return { status: 'LOST', probability: 0 };
  if (toStage === 'STAND_BY') return { status: 'STAND_BY', probability };
  if (toStage === 'NURTURE') return { status: 'NURTURE', probability };
  return { status: 'OPEN', probability: probability ?? currentProbability };
}
