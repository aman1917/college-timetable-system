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

      class: {
        include: {
          stream: true,
          academicYear: true,
        },
      },

      commonGroup: true,

      entries: {
        select: {
          groupId: true,
        },
      },
    },

    orderBy: {
      createdAt: 'desc' as const,
    },
  },

  describe: (_r: unknown, i: AllocationInput) =>
    `${i.subjectId} → ${i.teacherId} for ${i.classId} (${i.weeklyLectures}/week)${
      i.isCommon && i.commonGroupId
        ? ` [Common Group: ${i.commonGroupId}]`
        : ''
    }`,

  toCreateData: (input: AllocationInput) => ({
    teacherId: input.teacherId,
    subjectId: input.subjectId,
    classId: input.classId,

    roomId: input.roomId ? input.roomId : null,

    weeklyLectures: input.weeklyLectures,
    durationMinutes: input.durationMinutes,
    status: input.status,

    // Common teaching
    commonGroupId: input.commonGroupId
      ? input.commonGroupId
      : null,

    isCommon: input.isCommon ?? false,
  }),

  guardDelete: (id: string) =>
    refuseIfReferenced([
      {
        count: () =>
          prisma.timetableEntry.count({
            where: {
              allocationId: id,
            },
          }),
        noun: 'scheduled lecture',
      },
    ]),
};

export const { GET, POST } =
  createCollectionHandlers(allocationConfig);