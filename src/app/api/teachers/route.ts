import { createCollectionHandlers, refuseIfReferenced } from '@/lib/crud';
import { teacherSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { handleError, ok, parseBody, requireAdmin } from '@/lib/api';
import { recordAudit } from '@/lib/audit';
import type { z } from 'zod';

type TeacherInput = z.infer<typeof teacherSchema>;

/**
 * Full-time teachers with no explicit availability are expanded to "every
 * working day, college hours".
 *
 * Storing that explicitly rather than treating "no rows" as "always available"
 * keeps the collision engine simple: it only ever reads rows, and never has to
 * infer meaning from their absence.
 */
async function expandAvailability(input: TeacherInput) {
  if (input.availability.length > 0) return input.availability;
  if (input.employmentType === 'PART_TIME') return [];

  const settings = await prisma.appSetting.findUnique({ where: { id: 'singleton' } });
  const days = settings?.workingDays ?? (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const);
  return days.map((day) => ({
    day,
    startTime: settings?.fullTimeStart ?? '09:00',
    endTime: settings?.fullTimeEnd ?? '17:00',
  }));
}

function scalarFields(input: TeacherInput) {
  const { availability: _availability, departmentId, email, joiningDate, ...rest } = input;
  return {
    ...rest,
    email: email ? email : null,
    departmentId: departmentId ? departmentId : null,
    joiningDate: joiningDate ? new Date(joiningDate) : null,
  };
}

export const teacherConfig = {
  model: 'teacher' as const,
  label: 'Teacher',
  schema: teacherSchema,
  allowTeacherRead: true,
  findManyArgs: {
    include: { availability: true, department: true },
    orderBy: { name: 'asc' as const },
  },
  describe: (_r: unknown, i: TeacherInput) => i.name,
  toCreateData: (input: TeacherInput) => ({
    ...scalarFields(input),
    availability: { create: input.availability },
  }),
  // Availability is replaced wholesale on update. A partial merge would leave
  // stale windows behind, and a part-timer could stay schedulable on a day the
  // admin just removed.
  toUpdateData: (input: TeacherInput) => ({
    ...scalarFields(input),
    availability: { deleteMany: {}, create: input.availability },
  }),
  guardDelete: (id: string) =>
    refuseIfReferenced([
      {
        count: () => prisma.subjectAllocation.count({ where: { teacherId: id } }),
        noun: 'subject allocation',
      },
    ]),
};

export const { GET } = createCollectionHandlers(teacherConfig);

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const input = await parseBody(request, teacherSchema);
    const availability = await expandAvailability(input);

    const created = await prisma.teacher.create({
      data: { ...scalarFields(input), availability: { create: availability } },
    });

    await recordAudit({
      session,
      action: 'CREATE_TEACHER',
      entity: 'Teacher',
      entityId: created.id,
      summary: `Created Teacher: ${input.name} (${input.employmentType})`,
      after: { ...input, availability },
    });
    return ok(created, 201);
  } catch (error) {
    return handleError(error);
  }
}
