/**
 * Plain domain shapes used by the scheduling engine.
 *
 * Deliberately NOT Prisma types: the engine is pure, synchronous and
 * dependency-free so it can be unit-tested without a database, and so the
 * exact same code can run on the server (authoritative) and in the browser
 * (instant feedback while dragging). API routes map Prisma rows to these.
 */

export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export type SlotType = 'LECTURE' | 'BREAK' | 'LUNCH';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME';
export type SubjectType = 'THEORY' | 'PRACTICAL' | 'TUTORIAL' | 'ELECTIVE' | 'SPECIAL';
export type RoomType = 'CLASSROOM' | 'LAB' | 'SEMINAR';
export type RecordStatus = 'ACTIVE' | 'INACTIVE';

export interface AvailabilityWindow {
  day: Weekday;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface EngineTeacher {
  id: string;
  name: string;
  employmentType: EmploymentType;
  maxWeeklyLectures: number;
  maxDailyLectures: number;
  status: RecordStatus;
  availability: AvailabilityWindow[];
}

export interface EngineSubject {
  id: string;
  code: string;
  name: string;
  type: SubjectType;
  color: string;
  roomType: RoomType | null;
  weeklyLectures: number;
  durationMinutes: number;
}

export interface EngineClass {
  id: string;
  label: string; // pre-rendered, e.g. "TY BSCIT A"
}

export interface EngineRoom {
  id: string;
  name: string;
  type: RoomType;
}

export interface EngineSlot {
  id: string;
  startTime: string;
  endTime: string;
  type: SlotType;
  isActive: boolean;
  displayOrder: number;
}

export interface EngineAllocation {
  id: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  roomId: string | null;
  weeklyLectures: number;
  durationMinutes: number;
  status: RecordStatus;

  /**
   * Common Group support.
   *
   * When multiple allocations have the same commonGroupId,
   * they represent ONE real lecture that must be scheduled
   * at exactly the same day and time.
   */
  commonGroupId: string | null;
  isCommon: boolean;
}

export interface EngineEntry {
  id: string;
  groupId: string;
  day: Weekday;
  timeSlotId: string;
  allocationId: string;
}

/** Everything the engine needs, indexed for O(1) lookups. */
export interface EngineContext {
  workingDays: Weekday[];
  slots: EngineSlot[];
  entries: EngineEntry[];
  allocations: Map<string, EngineAllocation>;
  teachers: Map<string, EngineTeacher>;
  subjects: Map<string, EngineSubject>;
  classes: Map<string, EngineClass>;
  rooms: Map<string, EngineRoom>;
}

export interface ContextInput {
  workingDays: Weekday[];
  slots: EngineSlot[];
  entries: EngineEntry[];
  allocations: EngineAllocation[];
  teachers: EngineTeacher[];
  subjects: EngineSubject[];
  classes: EngineClass[];
  rooms: EngineRoom[];
}

export function buildContext(input: ContextInput): EngineContext {
  const index = <T extends { id: string }>(rows: T[]) => {
    const m = new Map<string, T>();

    for (const r of rows) {
      m.set(r.id, r);
    }

    return m;
  };

  return {
    workingDays: input.workingDays,

    // Slots are kept in chronological order everywhere downstream.
    slots: [...input.slots].sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    ),

    entries: input.entries,
    allocations: index(input.allocations),
    teachers: index(input.teachers),
    subjects: index(input.subjects),
    classes: index(input.classes),
    rooms: index(input.rooms),
  };
}

// ------------------------------------------------------------- time utils ---

/** "09:30" → 570. Returns 0 for malformed input rather than NaN. */
export function timeToMinutes(hhmm: string): number {
  if (!hhmm) return 0;

  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return 0;
  }

  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function slotDurationMinutes(slot: EngineSlot): number {
  return Math.max(
    1,
    timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime),
  );
}