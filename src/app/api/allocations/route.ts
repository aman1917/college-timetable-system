import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { allocationSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import type { z } from 'zod';

type AllocationInput = z.infer<typeof allocationSchema>;

export const allocationConfig = {
  model: 'subjectAllocation' as const,
  label: 'Subject Allocation',
  schema: allocationSchema,
  allowTeacherRead: true,
  findManyArgs: {
    include: {
      teacher: true,
      subject: true,
      room: true,
      class: { include: { stream: true, academicYear: true } },
      entries: { select: { groupId: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  describe: (_r: unknown, i: AllocationInput) =>
    `${i.subjectId} → ${i.teacherId} for ${i.classId} (${i.weeklyLectures}/week)`,
  toCreateData: (input: AllocationInput) => ({
    ...input,
    roomId: input.roomId ? input.roomId : null,
  }),
  // Deleting an allocation would cascade its timetable entries away silently.
  // Refusing keeps the timetable and the master data honest with each other.
  guardDelete: (id: string) =>
    refuseIfReferenced([
      { count: () => prisma.timetableEntry.count({ where: { allocationId: id } }), noun: 'scheduled lecture' },
    ]),
};

export const { GET, POST } = createCollectionHandlers(allocationConfig);
