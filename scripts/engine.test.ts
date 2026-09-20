/**
 * Engine test suite. Runs the REAL src/lib modules — no mocks, no database.
 *   npm run test:engine
 */

import {
  buildContext,
  type ContextInput,
  type EngineAllocation,
  type EngineEntry,
  type EngineSlot,
  type EngineTeacher,
  type Weekday,
  timeToMinutes,
} from '../src/lib/domain';
import {
  checkPlacement,
  checkPlacementDetailed,
  consecutiveWindows,
  findExistingConflicts,
  slotsNeeded,
  validTargets,
  windowStartingAt,
} from '../src/lib/collision';
import { generateTimetable } from '../src/lib/scheduler';
import { computeWorkload, unscheduledPool, validateTimetable } from '../src/lib/validation';

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra?: string) {
  if (cond) {
    pass++;
    console.log('  \u2713 ' + name);
  } else {
    fail++;
    console.log('  \u2717 ' + name + (extra ? '  \u2192 ' + extra : ''));
  }
}
function section(title: string) {
  console.log('\n=== ' + title + ' ===');
}

const DAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// 09:00 09:50 10:40 | BREAK | 11:45 12:35 | LUNCH | 14:15 15:05
const SLOTS: EngineSlot[] = [
  { id: 's1', startTime: '09:00', endTime: '09:50', type: 'LECTURE', isActive: true, displayOrder: 1 },
  { id: 's2', startTime: '09:50', endTime: '10:40', type: 'LECTURE', isActive: true, displayOrder: 2 },
  { id: 's3', startTime: '10:40', endTime: '11:30', type: 'LECTURE', isActive: true, displayOrder: 3 },
  { id: 'sb', startTime: '11:30', endTime: '11:45', type: 'BREAK', isActive: true, displayOrder: 4 },
  { id: 's4', startTime: '11:45', endTime: '12:35', type: 'LECTURE', isActive: true, displayOrder: 5 },
  { id: 's5', startTime: '12:35', endTime: '13:25', type: 'LECTURE', isActive: true, displayOrder: 6 },
  { id: 'sl', startTime: '13:25', endTime: '14:15', type: 'LUNCH', isActive: true, displayOrder: 7 },
  { id: 's6', startTime: '14:15', endTime: '15:05', type: 'LECTURE', isActive: true, displayOrder: 8 },
  { id: 's7', startTime: '15:05', endTime: '15:55', type: 'LECTURE', isActive: true, displayOrder: 9 },
];

function fullTime(id: string, name: string, over: Partial<EngineTeacher> = {}): EngineTeacher {
  return {
    id, name, employmentType: 'FULL_TIME', maxWeeklyLectures: 20, maxDailyLectures: 5, status: 'ACTIVE',
    availability: DAYS.map((d) => ({ day: d, startTime: '09:00', endTime: '17:00' })),
    ...over,
  };
}

function baseInput(): ContextInput {
  return {
    workingDays: DAYS,
    slots: SLOTS,
    entries: [],
    teachers: [
      fullTime('t1', 'Rahul Patil'),
      fullTime('t2', 'Anjali Deshmukh'),
      {
        id: 't3', name: 'Sameer Joshi', employmentType: 'PART_TIME',
        maxWeeklyLectures: 10, maxDailyLectures: 3, status: 'ACTIVE',
        availability: [
          { day: 'MON', startTime: '11:00', endTime: '15:00' },
          { day: 'WED', startTime: '11:00', endTime: '15:00' },
          { day: 'FRI', startTime: '11:00', endTime: '15:00' },
        ],
      },
    ],
    subjects: [
      { id: 'sub1', code: 'BSCIT301', name: 'DBMS', type: 'THEORY', color: '#6366f1', roomType: 'CLASSROOM', weeklyLectures: 4, durationMinutes: 50 },
      { id: 'sub2', code: 'BSCIT302', name: 'Computer Networks', type: 'THEORY', color: '#f59e0b', roomType: 'CLASSROOM', weeklyLectures: 3, durationMinutes: 50 },
      { id: 'sub3', code: 'BSCIT303P', name: 'DBMS Practical', type: 'PRACTICAL', color: '#22c55e', roomType: 'LAB', weeklyLectures: 2, durationMinutes: 100 },
      { id: 'sub4', code: 'BSCIT205', name: 'Operating Systems', type: 'THEORY', color: '#ec4899', roomType: 'CLASSROOM', weeklyLectures: 3, durationMinutes: 50 },
    ],
    classes: [
      { id: 'c1', label: 'TY BSCIT A' },
      { id: 'c2', label: 'TY BSCIT B' },
      { id: 'c3', label: 'SY BSCIT A' },
    ],
    rooms: [
      { id: 'r1', name: 'Room 201', type: 'CLASSROOM' },
      { id: 'r2', name: 'Room 202', type: 'CLASSROOM' },
      { id: 'r3', name: 'Computer Lab 1', type: 'LAB' },
    ],
    allocations: [
      { id: 'a1', teacherId: 't1', subjectId: 'sub1', classId: 'c1', roomId: 'r1', weeklyLectures: 4, durationMinutes: 50, status: 'ACTIVE' },
      { id: 'a2', teacherId: 't2', subjectId: 'sub2', classId: 'c1', roomId: 'r1', weeklyLectures: 3, durationMinutes: 50, status: 'ACTIVE' },
      { id: 'a3', teacherId: 't1', subjectId: 'sub3', classId: 'c1', roomId: 'r3', weeklyLectures: 2, durationMinutes: 100, status: 'ACTIVE' },
      { id: 'a4', teacherId: 't2', subjectId: 'sub4', classId: 'c3', roomId: 'r2', weeklyLectures: 3, durationMinutes: 50, status: 'ACTIVE' },
    ],
  };
}

const codes = (ctx: any, a: string, d: Weekday, s: string[], ex: string | null = null) =>
  checkPlacementDetailed(ctx, a, d, s, ex).map((v) => v.code);

// ---------------------------------------------------------------------------
section('1. Slot geometry');
{
  const ctx = buildContext(baseInput());
  ok('7 active lecture slots', consecutiveWindows(ctx, 1).length === 7, String(consecutiveWindows(ctx, 1).length));
  ok('4 two-period windows (break/lunch split the day 3+2+2)', consecutiveWindows(ctx, 2).length === 4, String(consecutiveWindows(ctx, 2).length));
  ok('no window contains a break or lunch', consecutiveWindows(ctx, 2).every((w) => !w.includes('sb') && !w.includes('sl')));
  ok('50-min theory needs 1 period', slotsNeeded(ctx, ctx.allocations.get('a1')!) === 1);
  ok('100-min practical needs 2 periods', slotsNeeded(ctx, ctx.allocations.get('a3')!) === 2);
  ok('no 2-period window starts at s3 (break follows)', windowStartingAt(ctx, 's3', 2) === null);
  ok('a 2-period window does start at s1', windowStartingAt(ctx, 's1', 2) !== null);
}

// ---------------------------------------------------------------------------
section('2. Occupancy collisions');
{
  const input = baseInput();
  input.entries = [{ id: 'e1', groupId: 'g1', day: 'MON', timeSlotId: 's1', allocationId: 'a1' }];
  const ctx = buildContext(input);

  ok('free slot accepts placement', checkPlacement(ctx, 'a4', 'TUE', ['s1']).ok);
  ok('CLASS collision detected', codes(ctx, 'a2', 'MON', ['s1']).includes('CLASS_COLLISION'));

  // Same teacher (t1), different class — isolates teacher collision from class collision.
  ctx.allocations.set('aX', { id: 'aX', teacherId: 't1', subjectId: 'sub2', classId: 'c2', roomId: 'r2', weeklyLectures: 2, durationMinutes: 50, status: 'ACTIVE' });
  ok('TEACHER collision detected', codes(ctx, 'aX', 'MON', ['s1']).includes('TEACHER_COLLISION'));
  ok('teacher collision names the clashing class', checkPlacement(ctx, 'aX', 'MON', ['s1']).reasons.some((r) => r.includes('TY BSCIT A')));

  // Different teacher + different class, same room — isolates room collision.
  ctx.allocations.set('aY', { id: 'aY', teacherId: 't2', subjectId: 'sub2', classId: 'c2', roomId: 'r1', weeklyLectures: 2, durationMinutes: 50, status: 'ACTIVE' });
  const yCodes = codes(ctx, 'aY', 'MON', ['s1']);
  ok('ROOM collision detected', yCodes.includes('ROOM_COLLISION'));
  ok('room collision is not confused with a class collision', !yCodes.includes('CLASS_COLLISION'));
  ok('different day is unaffected', checkPlacement(ctx, 'aY', 'TUE', ['s1']).ok);
}

// ---------------------------------------------------------------------------
section('3. Break / lunch / inactive / closed days');
{
  const input = baseInput();
  input.slots = [...SLOTS, { id: 'sX', startTime: '16:00', endTime: '16:50', type: 'LECTURE', isActive: false, displayOrder: 10 }];
  const ctx = buildContext(input);

  ok('BREAK slot rejected', codes(ctx, 'a1', 'MON', ['sb']).includes('NON_LECTURE_SLOT'));
  ok('LUNCH slot rejected', codes(ctx, 'a1', 'MON', ['sl']).includes('NON_LECTURE_SLOT'));
  ok('inactive slot rejected', codes(ctx, 'a1', 'MON', ['sX']).includes('NON_LECTURE_SLOT'));
  ok('non-working day rejected', codes(ctx, 'a1', 'SUN', ['s1']).includes('NOT_WORKING_DAY'));
  ok('inactive slot never appears in a window', consecutiveWindows(ctx, 1).every((w) => w[0] !== 'sX'));
}

// ---------------------------------------------------------------------------
section('4. Part-time availability');
{
  const input = baseInput();
  input.allocations.push({ id: 'aPT', teacherId: 't3', subjectId: 'sub2', classId: 'c2', roomId: 'r2', weeklyLectures: 3, durationMinutes: 50, status: 'ACTIVE' });
  const ctx = buildContext(input);

  ok('blocked on an unavailable DAY (Tue)', codes(ctx, 'aPT', 'TUE', ['s4']).includes('TEACHER_UNAVAILABLE_DAY'));
  ok('blocked BEFORE the window (09:00 < 11:00)', codes(ctx, 'aPT', 'MON', ['s1']).includes('TEACHER_UNAVAILABLE_TIME'));
  ok('blocked AFTER the window (15:55 > 15:00)', codes(ctx, 'aPT', 'MON', ['s7']).includes('TEACHER_UNAVAILABLE_TIME'));
  ok('ALLOWED inside the window (Wed 11:45)', checkPlacement(ctx, 'aPT', 'WED', ['s4']).ok, JSON.stringify(checkPlacement(ctx, 'aPT', 'WED', ['s4']).reasons));
  ok('full-time teacher unaffected by that window', checkPlacement(ctx, 'a1', 'TUE', ['s1']).ok);
}

// ---------------------------------------------------------------------------
section('5. Workload ceilings');
{
  const input = baseInput();
  input.teachers = input.teachers.map((t) => (t.id === 't1' ? { ...t, maxDailyLectures: 2, maxWeeklyLectures: 3 } : t));
  input.entries = [
    { id: 'e1', groupId: 'g1', day: 'MON', timeSlotId: 's1', allocationId: 'a1' },
    { id: 'e2', groupId: 'g2', day: 'MON', timeSlotId: 's2', allocationId: 'a1' },
  ];
  const ctx = buildContext(input);

  ok('DAILY limit enforced (3rd on Mon)', codes(ctx, 'a1', 'MON', ['s3']).includes('DAILY_LIMIT'));
  ok('other days still allowed under weekly cap', checkPlacement(ctx, 'a1', 'TUE', ['s1']).ok);

  ctx.entries.push({ id: 'e3', groupId: 'g3', day: 'TUE', timeSlotId: 's1', allocationId: 'a1' });
  ok('WEEKLY limit enforced (4th of 3)', codes(ctx, 'a1', 'WED', ['s1']).includes('WEEKLY_LIMIT'));
}

// ---------------------------------------------------------------------------
section('6. Room type + contiguity');
{
  const input = baseInput();
  // Deliberately mis-assign the LAB practical to a classroom.
  input.allocations = input.allocations.map((a) => (a.id === 'a3' ? { ...a, roomId: 'r1' } : a));
  const ctx = buildContext(input);
  ok('LAB requirement vs CLASSROOM detected', codes(ctx, 'a3', 'MON', ['s1', 's2']).includes('ROOM_TYPE_MISMATCH'));

  const ctx2 = buildContext(baseInput());
  ok('correct LAB assignment passes', checkPlacement(ctx2, 'a3', 'MON', ['s1', 's2']).ok, JSON.stringify(checkPlacement(ctx2, 'a3', 'MON', ['s1', 's2']).reasons));
  ok('2-period block across the BREAK rejected', codes(ctx2, 'a3', 'MON', ['s3', 's4']).includes('NOT_CONTIGUOUS'));
  ok('wrong period count rejected', codes(ctx2, 'a3', 'MON', ['s1']).includes('NOT_CONTIGUOUS'));
}

// ---------------------------------------------------------------------------
section('7. Move semantics (self-exclusion)');
{
  const input = baseInput();
  input.entries = [
    { id: 'e1', groupId: 'g1', day: 'MON', timeSlotId: 's1', allocationId: 'a3' },
    { id: 'e2', groupId: 'g1', day: 'MON', timeSlotId: 's2', allocationId: 'a3' },
  ];
  const ctx = buildContext(input);

  ok('without self-exclusion its own spot collides', !checkPlacement(ctx, 'a3', 'MON', ['s1', 's2']).ok);
  ok('with self-exclusion its own spot is legal', checkPlacement(ctx, 'a3', 'MON', ['s1', 's2'], 'g1').ok);
  ok('a different group still blocks it', !checkPlacement(ctx, 'a3', 'MON', ['s1', 's2'], 'other').ok);
}

// ---------------------------------------------------------------------------
section('8. validTargets matches checkPlacement exactly');
{
  const input = baseInput();
  input.entries = [{ id: 'e1', groupId: 'g1', day: 'MON', timeSlotId: 's1', allocationId: 'a1' }];
  const ctx = buildContext(input);

  const targets = validTargets(ctx, 'a2');
  ok('targets are non-empty', targets.size > 0, String(targets.size));

  let consistent = true;
  for (const key of targets) {
    const [day, slot] = key.split('|');
    const w = windowStartingAt(ctx, slot, slotsNeeded(ctx, ctx.allocations.get('a2')!));
    if (!w || !checkPlacement(ctx, 'a2', day as Weekday, w).ok) consistent = false;
  }
  ok('every highlighted target genuinely passes the engine', consistent);
  ok('the occupied Mon 09:00 cell is NOT offered', !targets.has('MON|s1'));

  // And the converse: nothing legal is omitted.
  let omissions = 0;
  for (const day of ctx.workingDays) {
    for (const w of consecutiveWindows(ctx, 1)) {
      if (checkPlacement(ctx, 'a2', day, w).ok && !targets.has(`${day}|${w[0]}`)) omissions++;
    }
  }
  ok('no legal target is omitted', omissions === 0, String(omissions));
}

// ---------------------------------------------------------------------------
section('9. Auto-generation');
{
  const ctx = buildContext(baseInput());
  const result = generateTimetable(ctx);

  ok('generation reports completion', result.complete, JSON.stringify(result.shortfalls));
  ok('zero collisions produced', findExistingConflicts(ctx).length === 0);
  ok('every allocation fully satisfied', unscheduledPool(ctx).length === 0);
  ok('nothing landed on break/lunch', ctx.entries.every((e) => !['sb', 'sl'].includes(e.timeSlotId)));
  ok('practical stayed contiguous and same-day', (() => {
    const g = new Map<string, EngineEntry[]>();
    for (const e of ctx.entries) g.set(e.groupId, [...(g.get(e.groupId) ?? []), e]);
    for (const list of g.values()) {
      if (list.length < 2) continue;
      if (new Set(list.map((x) => x.day)).size !== 1) return false;
      const idx = list.map((x) => ctx.slots.findIndex((s) => s.id === x.timeSlotId)).sort((a, b) => a - b);
      for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1] + 1) return false;
    }
    return true;
  })());
  ok('returned entries match what landed in context', result.placedPeriods === ctx.entries.length);
  ok('generation is deterministic for a fixed seed', (() => {
    const a = buildContext(baseInput()); generateTimetable(a, 42);
    const b = buildContext(baseInput()); generateTimetable(b, 42);
    const key = (c: any) => c.entries.map((e: EngineEntry) => `${e.allocationId}|${e.day}|${e.timeSlotId}`).sort().join(',');
    return key(a) === key(b);
  })());
}

// ---------------------------------------------------------------------------
section('10. Auto-generation respects part-time limits under pressure');
{
  const input = baseInput();
  // Give the part-timer more work than their 3-day / 11:00-15:00 window allows.
  input.allocations.push({ id: 'aPT', teacherId: 't3', subjectId: 'sub2', classId: 'c2', roomId: 'r2', weeklyLectures: 12, durationMinutes: 50, status: 'ACTIVE' });
  const ctx = buildContext(input);
  generateTimetable(ctx);

  ok('no collisions even when over-subscribed', findExistingConflicts(ctx).length === 0);
  const ptEntries = ctx.entries.filter((e) => ctx.allocations.get(e.allocationId)?.teacherId === 't3');
  ok('part-timer only scheduled on available days', ptEntries.every((e) => ['MON', 'WED', 'FRI'].includes(e.day)));
  ok('part-timer only scheduled inside 11:00-15:00', ptEntries.every((e) => {
    const s = ctx.slots.find((x) => x.id === e.timeSlotId)!;
    return timeToMinutes(s.startTime) >= 660 && timeToMinutes(s.endTime) <= 900;
  }));
  ok('part-timer never exceeds weekly cap', ptEntries.length <= 10, String(ptEntries.length));
  ok('over-subscription is REPORTED, not silently dropped', validateTimetable(ctx).checks.find((c) => c.key === 'lectures_complete')!.details.length > 0);
}

// ---------------------------------------------------------------------------
section('11. Validation report');
{
  const ctx = buildContext(baseInput());
  generateTimetable(ctx);
  const report = validateTimetable(ctx);

  ok('clean generated timetable is READY TO PUBLISH', report.ok, JSON.stringify(report.checks.filter((c) => !c.pass)));
  ok('all 8 checks present', report.checks.length === 8, String(report.checks.length));

  // Break it deliberately.
  ctx.allocations.get('a1')!.weeklyLectures = 99;
  const broken = validateTimetable(ctx);
  ok('unmet requirement fails validation', !broken.ok);
  ok('summary explains the failure', broken.summary.startsWith('CANNOT PUBLISH'));
  ctx.allocations.get('a1')!.weeklyLectures = 4;

  ctx.subjects.set('orphan', { id: 'orphan', code: 'ORP1', name: 'Orphan', type: 'THEORY', color: '#000', roomType: null, weeklyLectures: 2, durationMinutes: 50 });
  ok('unallocated subject detected', !validateTimetable(ctx).checks.find((c) => c.key === 'subjects_allocated')!.pass);
}

// ---------------------------------------------------------------------------
section('12. Workload derivation');
{
  const ctx = buildContext(baseInput());
  generateTimetable(ctx);
  const w = computeWorkload(ctx, 't1');

  ok('requiredBlocks = sum of allocated weekly lectures', w.requiredBlocks === 6, String(w.requiredBlocks));
  ok('theory + practical = required', w.theoryBlocks + w.practicalBlocks === w.requiredBlocks);
  ok('practical blocks counted separately', w.practicalBlocks === 2, String(w.practicalBlocks));
  ok('scheduledPeriods counts a 100-min practical as 2 periods', w.scheduledPeriods === 8, String(w.scheduledPeriods));
  ok('perDay covers every working day', Object.keys(w.perDay).length === DAYS.length);
  ok('perDay sums to scheduledPeriods', Object.values(w.perDay).reduce((a, b) => a + b, 0) === w.scheduledPeriods);
  ok('not flagged overloaded within limits', !w.isOverloaded);
}

// ---------------------------------------------------------------------------
section('13. Time helpers');
{
  ok('09:00 -> 540', timeToMinutes('09:00') === 540);
  ok('15:05 -> 905', timeToMinutes('15:05') === 905);
  ok('malformed input -> 0 (never NaN)', timeToMinutes('abc') === 0);
  ok('empty input -> 0', timeToMinutes('') === 0);
}

console.log(`\n${'\u2500'.repeat(34)}\nPASSED: ${pass}   FAILED: ${fail}\n${'\u2500'.repeat(34)}`);
process.exit(fail ? 1 : 0);
