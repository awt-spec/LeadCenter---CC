import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
let taskId: string;

beforeAll(async () => {
  prisma = new PrismaClient({ log: ['error'] });
  // Pick the task with the most comments / subtasks
  const top = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT t.id FROM "Task" t
       LEFT JOIN "Task" s ON s."parentTaskId" = t.id
       LEFT JOIN "TaskComment" c ON c."taskId" = t.id
       GROUP BY t.id ORDER BY (COUNT(s.id) + COUNT(c.id)) DESC LIMIT 1`
  );
  taskId = top[0]?.id ?? '';
}, 60_000);

afterAll(async () => { await prisma.$disconnect(); });

async function fetchTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      subtasks: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: 30,
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      attachments: {
        orderBy: { uploadedAt: 'desc' },
        take: 20,
      },
    },
  });
}

describe('OPT-004: getTaskById limita arrays nested', () => {
  it('subtasks con take 30', async () => {
    expect(taskId).toBeTruthy();
    const task = await fetchTask(taskId);
    if (!task) return;
    expect(task.subtasks.length).toBeLessThanOrEqual(30);
  });

  it('comments con take 50', async () => {
    const task = await fetchTask(taskId);
    if (!task) return;
    expect(task.comments.length).toBeLessThanOrEqual(50);
  });

  it('attachments con take 20', async () => {
    const task = await fetchTask(taskId);
    if (!task) return;
    expect(task.attachments.length).toBeLessThanOrEqual(20);
  });
});
