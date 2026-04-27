import type { OpportunityStage } from '@prisma/client';
import { STAGE_PROBABILITY } from '@/lib/opportunities/stage-rules';

export type PipelineOpportunityCard = {
  id: string;
  code: string | null;
  name: string;
  stage: OpportunityStage;
  status: string;
  product: string;
  rating: string;
  estimatedValue: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: Date | null;
  nextActionDate: Date | null;
  nextActionNote: string | null;
  stageChangedAt: Date;
  updatedAt: Date;
  lastActivityAt: Date | null;
  account: { id: string; name: string };
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  primaryContact: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
  } | null;
  description: string | null;
  portfolioAmount: number | null;
  userCount: number | null;
  annualOperations: number | null;
  clientCount: number | null;
};

export function groupByStage(cards: PipelineOpportunityCard[]) {
  const grouped = new Map<OpportunityStage, PipelineOpportunityCard[]>();
  for (const c of cards) {
    const arr = grouped.get(c.stage);
    if (arr) arr.push(c);
    else grouped.set(c.stage, [c]);
  }
  return grouped;
}

export function computeColumnStats(cards: PipelineOpportunityCard[]) {
  const total = cards.reduce((acc, c) => acc + (c.estimatedValue ?? 0), 0);
  const weighted = cards.reduce((acc, c) => {
    const prob = STAGE_PROBABILITY[c.stage];
    return acc + (c.estimatedValue ?? 0) * (prob / 100);
  }, 0);
  return { count: cards.length, total, weighted };
}
