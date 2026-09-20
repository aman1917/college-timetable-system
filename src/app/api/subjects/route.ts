import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { subjectSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';

export const subjectConfig = {
  model: 'subject' as const,
  label: 'Subject',
  schema: subjectSchema,
  allowTeacherRead: true,
  findManyArgs: { include: { stream: true }, orderBy: { code: 'asc' as const } },
  describe: (_r: unknown, i: { code: string; name: string }) => `${i.code} — ${i.name}`,
  guardDelete: (id: string) =>
    refuseIfReferenced([
      { count: () => prisma.subjectAllocation.count({ where: { subjectId: id } }), noun: 'subject allocation' },
    ]),
};

export const { GET, POST } = createCollectionHandlers(subjectConfig);
