/**
 * Seed script.
 *
 * Always creates: the settings singleton and an administrator account.
 * Optionally creates demo data (SEED_DEMO_DATA=false to skip) so you can log in
 * to a populated system and press Auto-Generate immediately.
 *
 * Idempotent — safe to re-run. Uses upserts keyed on natural unique fields.
 */

import { PrismaClient, type Weekday } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const WORKING_DAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@college.edu').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD ?? 'Teacher@12345';
  const withDemo = (process.env.SEED_DEMO_DATA ?? 'true') !== 'false';

  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
  }

  // ---- settings singleton -------------------------------------------------
  await prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      collegeName: 'Hirwal Education Trust College of Science(Computer Science & Information Technology)',
      defaultDuration: 50,
      workingDays: WORKING_DAYS,
      fullTimeStart: '08:00',
      fullTimeEnd: '15:00',
      timetableStatus: 'DRAFT',
    },
  });

  // ---- administrator ------------------------------------------------------
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', isActive: true },
    create: {
      email: adminEmail,
      name: 'System Administrator',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`✓ Admin ready: ${adminEmail}`);

  if (!withDemo) {
    console.log('✓ SEED_DEMO_DATA=false — skipping demo data.');
    return;
  }

  // ---- departments --------------------------------------------------------
  const deptCS = await prisma.department.upsert({
    where: { code: 'CS' },
    update: {},
    create: { name: 'Computer Science', code: 'CS' },
  });
  const deptCom = await prisma.department.upsert({
    where: { code: 'COM' },
    update: {},
    create: { name: 'Commerce', code: 'COM' },
  });

  // ---- streams ------------------------------------------------------------
  const streamDefs = [
    { name: 'BSCIT', code: 'BSCIT', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 1 },
    { name: 'BSCCS', code: 'BSCCS', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 2 },
    // Stream name is configurable from Settings — this one is deliberately a
    // combined label to show that it is free text, not a hard-coded enum.
    { name: 'BSC / BCOM', code: 'BSCBCOM', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 3 },
    { name: 'BCOM', code: 'BCOM', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 4 },
    { name: 'BCOM(MS)', code: 'BCOMMS', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 5 },
    { name: '5-Year LLB', code: 'LLB', yearStructure: 'LLB_FIVE_YEAR' as const, displayOrder: 6 },
  ];
  const streams: Record<string, string> = {};
  for (const def of streamDefs) {
    const row = await prisma.stream.upsert({ where: { code: def.code }, update: {}, create: def });
    streams[def.code] = row.id;
  }

  // ---- academic year ------------------------------------------------------
  const ay = await prisma.academicYear.upsert({
    where: { label: '2026-27' },
    update: { isActive: true },
    create: { label: '2026-27', isActive: true },
  });

  // ---- classes ------------------------------------------------------------
  const classDefs = [
    { streamCode: 'BSCIT', year: 'TY', semester: 5, division: 'A' },
    { streamCode: 'BSCIT', year: 'TY', semester: 5, division: 'B' },
    { streamCode: 'BSCIT', year: 'SY', semester: 3, division: 'A' },
    { streamCode: 'BSCIT', year: 'FY', semester: 1, division: 'A' },
    { streamCode: 'BCOM', year: 'FY', semester: 1, division: 'A' },
    { streamCode: 'LLB', year: 'Year 1', semester: 1, division: 'A' },
  ];
  const classes: Record<string, string> = {};
  for (const def of classDefs) {
    const row = await prisma.class.upsert({
      where: {
        streamId_academicYearId_year_semester_division: {
          streamId: streams[def.streamCode],
          academicYearId: ay.id,
          year: def.year,
          semester: def.semester,
          division: def.division,
        },
      },
      update: {},
      create: {
        streamId: streams[def.streamCode],
        academicYearId: ay.id,
        year: def.year,
        semester: def.semester,
        division: def.division,
        strength: 60,
      },
    });
    classes[`${def.streamCode}-${def.year}-${def.division}`] = row.id;
  }

  // ---- rooms --------------------------------------------------------------
  const roomDefs = [
    { name: 'Room 201', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 202', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 203', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Computer Lab 1', type: 'LAB' as const, capacity: 35 },
    { name: 'Computer Lab 2', type: 'LAB' as const, capacity: 35 },
    { name: 'Seminar Hall', type: 'SEMINAR' as const, capacity: 150 },
  ];
  const rooms: Record<string, string> = {};
  for (const def of roomDefs) {
    const row = await prisma.room.upsert({ where: { name: def.name }, update: {}, create: def });
    rooms[def.name] = row.id;
  }

  // ---- time slots ---------------------------------------------------------
  const slotDefs = [
    { startTime: '09:00', endTime: '09:50', type: 'LECTURE' as const, displayOrder: 1 },
    { startTime: '09:50', endTime: '10:40', type: 'LECTURE' as const, displayOrder: 2 },
    { startTime: '10:40', endTime: '11:30', type: 'LECTURE' as const, displayOrder: 3 },
    { startTime: '11:30', endTime: '11:45', type: 'BREAK' as const, displayOrder: 4 },
    { startTime: '11:45', endTime: '12:35', type: 'LECTURE' as const, displayOrder: 5 },
    { startTime: '12:35', endTime: '13:25', type: 'LECTURE' as const, displayOrder: 6 },
    { startTime: '13:25', endTime: '14:15', type: 'LUNCH' as const, displayOrder: 7 },
    { startTime: '14:15', endTime: '15:05', type: 'LECTURE' as const, displayOrder: 8 },
    { startTime: '15:05', endTime: '15:55', type: 'LECTURE' as const, displayOrder: 9 },
  ];
  for (const def of slotDefs) {
    await prisma.timeSlot.upsert({
      where: { startTime_endTime: { startTime: def.startTime, endTime: def.endTime } },
      update: {},
      create: def,
    });
  }

  // ---- teachers -----------------------------------------------------------
  const teacherDefs = [
    {
      teacherCode: 'T-001', name: 'Rahul Patil', email: 'rahul.patil@college.edu',
      mobile: '9800000001', departmentId: deptCS.id, designation: 'Assistant Professor',
      qualification: 'M.Sc. CS, NET', employmentType: 'FULL_TIME' as const,
      maxWeeklyLectures: 20, maxDailyLectures: 5,
      availability: WORKING_DAYS.map((day) => ({ day, startTime: '09:00', endTime: '17:00' })),
    },
    {
      teacherCode: 'T-002', name: 'Anjali Deshmukh', email: 'anjali.deshmukh@college.edu',
      mobile: '9800000002', departmentId: deptCS.id, designation: 'Assistant Professor',
      qualification: 'M.C.A.', employmentType: 'FULL_TIME' as const,
      maxWeeklyLectures: 20, maxDailyLectures: 5,
      availability: WORKING_DAYS.map((day) => ({ day, startTime: '09:00', endTime: '17:00' })),
    },
    {
      teacherCode: 'T-003', name: 'Meera Kulkarni', email: 'meera.kulkarni@college.edu',
      mobile: '9800000003', departmentId: deptCS.id, designation: 'Associate Professor',
      qualification: 'Ph.D. Computer Science', employmentType: 'FULL_TIME' as const,
      maxWeeklyLectures: 18, maxDailyLectures: 4,
      availability: WORKING_DAYS.map((day) => ({ day, startTime: '09:00', endTime: '17:00' })),
    },
    {
      // Deliberately constrained, so the collision engine has something real to
      // enforce the moment you press Auto-Generate.
      teacherCode: 'T-004', name: 'Sameer Joshi', email: 'sameer.joshi@college.edu',
      mobile: '9800000004', departmentId: deptCom.id, designation: 'Visiting Faculty',
      qualification: 'M.Com.', employmentType: 'PART_TIME' as const,
      maxWeeklyLectures: 10, maxDailyLectures: 3,
      notes: 'Available afternoons only, three days a week.',
      availability: [
        { day: 'MON' as Weekday, startTime: '11:00', endTime: '15:00' },
        { day: 'WED' as Weekday, startTime: '11:00', endTime: '15:00' },
        { day: 'FRI' as Weekday, startTime: '11:00', endTime: '15:00' },
      ],
    },
  ];

  const teachers: Record<string, string> = {};
  for (const def of teacherDefs) {
    const { availability, ...scalar } = def;
    const row = await prisma.teacher.upsert({
      where: { teacherCode: def.teacherCode },
      update: {},
      create: { ...scalar, availability: { create: availability } },
    });
    teachers[def.teacherCode] = row.id;

    // Each teacher gets a login so the TEACHER role can be demonstrated.
    if (def.email) {
      await prisma.user.upsert({
        where: { email: def.email.toLowerCase() },
        update: { teacherId: row.id },
        create: {
          email: def.email.toLowerCase(),
          name: def.name,
          role: 'TEACHER',
          passwordHash: await bcrypt.hash(teacherPassword, 10),
          teacherId: row.id,
        },
      });
    }
  }

  // ---- subjects -----------------------------------------------------------
  const subjectDefs = [
    { code: 'BSCIT301', name: 'Database Management System', streamCode: 'BSCIT', year: 'TY', semester: 5, type: 'THEORY' as const, weeklyLectures: 4, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#6366f1', credits: 4 },
    { code: 'BSCIT302', name: 'Computer Networks', streamCode: 'BSCIT', year: 'TY', semester: 5, type: 'THEORY' as const, weeklyLectures: 3, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#f59e0b', credits: 4 },
    { code: 'BSCIT303', name: 'Software Engineering', streamCode: 'BSCIT', year: 'TY', semester: 5, type: 'THEORY' as const, weeklyLectures: 3, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#06b6d4', credits: 3 },
    { code: 'BSCIT304P', name: 'DBMS Practical', streamCode: 'BSCIT', year: 'TY', semester: 5, type: 'PRACTICAL' as const, weeklyLectures: 2, durationMinutes: 100, roomType: 'LAB' as const, color: '#22c55e', credits: 2 },
    { code: 'BSCIT201', name: 'Operating Systems', streamCode: 'BSCIT', year: 'SY', semester: 3, type: 'THEORY' as const, weeklyLectures: 3, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#ec4899', credits: 4 },
    { code: 'BSCIT202', name: 'Data Structures', streamCode: 'BSCIT', year: 'SY', semester: 3, type: 'THEORY' as const, weeklyLectures: 4, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#a855f7', credits: 4 },
    { code: 'BSCIT101', name: 'Programming Fundamentals', streamCode: 'BSCIT', year: 'FY', semester: 1, type: 'THEORY' as const, weeklyLectures: 4, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#14b8a6', credits: 4 },
    { code: 'BCOM101', name: 'Financial Accounting', streamCode: 'BCOM', year: 'FY', semester: 1, type: 'THEORY' as const, weeklyLectures: 3, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#ef4444', credits: 4 },
    { code: 'LLB101', name: 'Constitutional Law I', streamCode: 'LLB', year: 'Year 1', semester: 1, type: 'THEORY' as const, weeklyLectures: 3, durationMinutes: 50, roomType: 'CLASSROOM' as const, color: '#3b82f6', credits: 4 },
  ];

  const subjects: Record<string, string> = {};
  for (const def of subjectDefs) {
    const { streamCode, ...rest } = def;
    const row = await prisma.subject.upsert({
      where: { code: def.code },
      update: {},
      create: { ...rest, streamId: streams[streamCode] },
    });
    subjects[def.code] = row.id;
  }

  // ---- syllabus -----------------------------------------------------------
  await prisma.syllabus.upsert({
    where: { subjectId: subjects.BSCIT301 },
    update: {},
    create: {
      subjectId: subjects.BSCIT301,
      unit1: 'Introduction to DBMS, ER model, relational model',
      unit2: 'Relational algebra, SQL fundamentals, joins and subqueries',
      unit3: 'Functional dependencies and normalization (1NF to BCNF)',
      unit4: 'Transactions, concurrency control, recovery',
      unit5: 'Indexing, query processing, introduction to NoSQL',
      estimatedLectures: 60,
    },
  });

  // ---- allocations --------------------------------------------------------
  const allocationDefs = [
    { subject: 'BSCIT301', teacher: 'T-001', klass: 'BSCIT-TY-A', weekly: 4, duration: 50, room: 'Room 201' },
    { subject: 'BSCIT302', teacher: 'T-002', klass: 'BSCIT-TY-A', weekly: 3, duration: 50, room: 'Room 201' },
    { subject: 'BSCIT303', teacher: 'T-003', klass: 'BSCIT-TY-A', weekly: 3, duration: 50, room: 'Room 201' },
    { subject: 'BSCIT304P', teacher: 'T-001', klass: 'BSCIT-TY-A', weekly: 2, duration: 100, room: 'Computer Lab 1' },
    { subject: 'BSCIT201', teacher: 'T-002', klass: 'BSCIT-SY-A', weekly: 3, duration: 50, room: 'Room 202' },
    { subject: 'BSCIT202', teacher: 'T-003', klass: 'BSCIT-SY-A', weekly: 4, duration: 50, room: 'Room 202' },
    { subject: 'BSCIT101', teacher: 'T-001', klass: 'BSCIT-FY-A', weekly: 4, duration: 50, room: 'Room 203' },
    { subject: 'BCOM101', teacher: 'T-004', klass: 'BCOM-FY-A', weekly: 3, duration: 50, room: 'Room 203' },
    { subject: 'LLB101', teacher: 'T-004', klass: 'LLB-Year 1-A', weekly: 3, duration: 50, room: 'Seminar Hall' },
  ];

  for (const def of allocationDefs) {
    await prisma.subjectAllocation.upsert({
      where: {
        subjectId_classId: { subjectId: subjects[def.subject], classId: classes[def.klass] },
      },
      update: {},
      create: {
        subjectId: subjects[def.subject],
        classId: classes[def.klass],
        teacherId: teachers[def.teacher],
        roomId: rooms[def.room],
        weeklyLectures: def.weekly,
        durationMinutes: def.duration,
      },
    });
  }

  const counts = {
    streams: await prisma.stream.count(),
    classes: await prisma.class.count(),
    teachers: await prisma.teacher.count(),
    subjects: await prisma.subject.count(),
    rooms: await prisma.room.count(),
    slots: await prisma.timeSlot.count(),
    allocations: await prisma.subjectAllocation.count(),
  };

  console.log('✓ Demo data seeded:', counts);
  console.log('\nSign in with:');
  console.log(`  Admin   → ${adminEmail} / ${adminPassword}`);
  console.log(`  Teacher → rahul.patil@college.edu / ${teacherPassword}`);
  console.log('\nNext: open /timetable/builder and press "Auto-Generate".');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
