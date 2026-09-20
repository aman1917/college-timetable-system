import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { roomSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';

export const roomConfig = {
  model: 'room' as const,
  label: 'Room',
  schema: roomSchema,
  allowTeacherRead: true,
  findManyArgs: { orderBy: { name: 'asc' as const } },
  describe: (_r: unknown, i: { name: string }) => i.name,
  guardDelete: (id: string) =>
    refuseIfReferenced([
      { count: () => prisma.subjectAllocation.count({ where: { roomId: id } }), noun: 'subject allocation' },
    ]),
};

export const { GET, POST } = createCollectionHandlers(roomConfig);
