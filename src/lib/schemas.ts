/**
 * Request validation. Every write endpoint parses its body through one of these,
 * so malformed or hostile input is rejected before it reaches Prisma.
 */
import { z } from 'zod';

const HHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM, e.g. 09:30');

const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour, e.g. #6366f1');

export const weekdayEnum = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
export const recordStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const roomTypeEnum = z.enum(['CLASSROOM', 'LAB', 'SEMINAR']);

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const streamSchema = z.object({
  name: z.string().min(1, 'Stream name is required.').max(80),
  code: z.string().min(1, 'Short code is required.').max(20),
  yearStructure: z.enum(['UG_THREE_YEAR', 'LLB_FIVE_YEAR']).default('UG_THREE_YEAR'),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

export const academicYearSchema = z.object({
  label: z.string().min(1, 'Label is required.').max(20),
  isActive: z.boolean().default(false),
});

export const classSchema = z.object({
  streamId: z.string().min(1, 'Choose a stream.'),
  academicYearId: z.string().min(1, 'Choose an academic year.'),
  year: z.string().min(1, 'Choose a year.'),
  semester: z.coerce.number().int().refine((v) => v === 1 || v === 2, {
    message: 'Semester must be Odd (1) or Even (2).',
  }),
  division: z.string().min(1, 'Division is required.').max(5),
  strength: z.coerce.number().int().min(0).max(500).optional().nullable(),
});

export const availabilitySchema = z.object({
  day: weekdayEnum,
  startTime: HHMM,
  endTime: HHMM,
});

export const teacherSchema = z
  .object({
    teacherCode: z.string().min(1, 'Teacher ID is required.').max(20),
    name: z.string().min(1, 'Name is required.').max(120),
    email: z.string().email('Enter a valid email.').optional().nullable().or(z.literal('')),
    mobile: z.string().max(20).optional().nullable(),
    departmentId: z.string().optional().nullable(),
    designation: z.string().max(80).optional().nullable(),
    qualification: z.string().max(120).optional().nullable(),
    employmentType: z.enum(['FULL_TIME', 'PART_TIME']).default('FULL_TIME'),
    joiningDate: z.string().optional().nullable(),
    status: recordStatusEnum.default('ACTIVE'),
    maxWeeklyLectures: z.coerce.number().int().min(0).max(60).default(20),
    maxDailyLectures: z.coerce.number().int().min(0).max(12).default(5),
    notes: z.string().max(1000).optional().nullable(),
    availability: z.array(availabilitySchema).default([]),
  })
  .refine(
    (t) => t.availability.every((a) => a.startTime < a.endTime),
    { message: 'Each availability window must end after it starts.', path: ['availability'] },
  )
  .refine(
    (t) => t.employmentType === 'FULL_TIME' || t.availability.length > 0,
    { message: 'Part-time teachers need at least one availability window.', path: ['availability'] },
  );

export const subjectSchema = z.object({
  code: z.string().min(1, 'Subject code is required.').max(30),
  name: z.string().min(1, 'Subject name is required.').max(160),
  streamId: z.string().min(1, 'Choose a stream.'),
  year: z.string().min(1, 'Choose a year.'),
  semester: z.coerce.number().int().refine((v) => v === 1 || v === 2, {
    message: 'Semester must be Odd (1) or Even (2).',
  }),
  type: z.enum(['THEORY', 'PRACTICAL', 'TUTORIAL', 'ELECTIVE', 'SPECIAL']).default('THEORY'),
  credits: z.coerce.number().int().min(0).max(20).default(3),
  weeklyLectures: z.coerce.number().int().min(1, 'At least one lecture per week.').max(20).default(3),
  durationMinutes: z.coerce.number().int().min(20).max(300).default(50),
  roomType: roomTypeEnum.optional().nullable(),
  color: HEX_COLOR.default('#6366f1'),
  status: recordStatusEnum.default('ACTIVE'),
});

export const syllabusSchema = z.object({
  subjectId: z.string().min(1, 'Choose a subject.'),
  unit1: z.string().max(2000).optional().nullable(),
  unit2: z.string().max(2000).optional().nullable(),
  unit3: z.string().max(2000).optional().nullable(),
  unit4: z.string().max(2000).optional().nullable(),
  unit5: z.string().max(2000).optional().nullable(),
  estimatedLectures: z.coerce.number().int().min(0).max(200).optional().nullable(),
});

export const allocationSchema = z.object({
  teacherId: z.string().min(1, 'Choose a teacher.'),
  subjectId: z.string().min(1, 'Choose a subject.'),
  classId: z.string().min(1, 'Choose a class.'),
  roomId: z.string().optional().nullable(),
  weeklyLectures: z.coerce.number().int().min(1, 'At least one lecture per week.').max(20),
  durationMinutes: z.coerce.number().int().min(20).max(300).default(50),
  status: recordStatusEnum.default('ACTIVE'),
});

export const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required.').max(60),
  type: roomTypeEnum.default('CLASSROOM'),
  capacity: z.coerce.number().int().min(1).max(1000).default(60),
  building: z.string().max(60).optional().nullable(),
  status: recordStatusEnum.default('ACTIVE'),
});

export const timeSlotSchema = z
  .object({
    startTime: HHMM,
    endTime: HHMM,
    type: z.enum(['LECTURE', 'BREAK', 'LUNCH']).default('LECTURE'),
    isActive: z.boolean().default(true),
    displayOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine((s) => s.startTime < s.endTime, {
    message: 'End time must be after start time.',
    path: ['endTime'],
  });

export const settingsSchema = z.object({
  collegeName: z.string().min(1).max(160),
  defaultDuration: z.coerce.number().int().min(20).max(300),
  workingDays: z.array(weekdayEnum).min(1, 'Select at least one working day.'),
  fullTimeStart: HHMM,
  fullTimeEnd: HHMM,
  timetableStatus: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']),
});

export const placeSchema = z.object({
  allocationId: z.string().min(1),
  day: weekdayEnum,
  startSlotId: z.string().min(1),
});

export const moveSchema = z.object({
  groupId: z.string().min(1),
  day: weekdayEnum,
  startSlotId: z.string().min(1),
});

export const generateSchema = z.object({
  seed: z.coerce.number().int().optional(),
  clearExisting: z.boolean().default(false),
});