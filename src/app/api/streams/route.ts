import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { streamSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';

export const streamConfig = {
  model: 'stream' as const,
  label: 'Stream',
  schema: streamSchema,
  allowTeacherRead: true,
  findManyArgs: { orderBy: [{ displayOrder: 'asc' as const }, { name: 'asc' as const }] },
  describe: (_r: unknown, i: { name: string }) => i.name,
  guardDelete: (id: string) =>
    refuseIfReferenced([
      { count: () => prisma.class.count({ where: { streamId: id } }), noun: 'class' },
      { count: () => prisma.subject.count({ where: { streamId: id } }), noun: 'subject' },
    ]),
};

export const { GET, POST } = createCollectionHandlers(streamConfig);
