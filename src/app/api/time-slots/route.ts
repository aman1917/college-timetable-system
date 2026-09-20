import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { timeSlotSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';

export const timeSlotConfig = {
  model: 'timeSlot' as const,
  label: 'Time Slot',
  schema: timeSlotSchema,
  allowTeacherRead: true,
  findManyArgs: { orderBy: [{ displayOrder: 'asc' as const }, { startTime: 'asc' as const }] },
  describe: (_r: unknown, i: { startTime: string; endTime: string }) => `${i.startTime}–${i.endTime}`,
  guardDelete: (id: string) =>
    refuseIfReferenced([
      { count: () => prisma.timetableEntry.count({ where: { timeSlotId: id } }), noun: 'scheduled lecture' },
    ]),
};

export const { GET, POST } = createCollectionHandlers(timeSlotConfig);
