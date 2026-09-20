import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { academicYearSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';

export const academicYearConfig = {
  model: 'academicYear' as const,
  label: 'Academic Year',
  schema: academicYearSchema,
  allowTeacherRead: true,
  findManyArgs: { orderBy: { label: 'desc' as const } },
  describe: (_r: unknown, i: { label: string }) => i.label,
  guardDelete: (id: string) =>
    refuseIfReferenced([
      { count: () => prisma.class.count({ where: { academicYearId: id } }), noun: 'class' },
    ]),
};

export const { GET, POST } = createCollectionHandlers(academicYearConfig);
