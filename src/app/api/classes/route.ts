import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { classSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';

export const classConfig = {
  model: 'class' as const,
  label: 'Class',
  schema: classSchema,
  allowTeacherRead: true,
  findManyArgs: {
    include: { stream: true, academicYear: true },
    orderBy: [{ year: 'asc' as const }, { division: 'asc' as const }],
  },
  describe: (_r: unknown, i: { year: string; division: string }) => `${i.year} ${i.division}`,
  guardDelete: (id: string) =>
    refuseIfReferenced([
      { count: () => prisma.subjectAllocation.count({ where: { classId: id } }), noun: 'subject allocation' },
    ]),
};

export const { GET, POST } = createCollectionHandlers(classConfig);
