/**
 * PDF-based seed for GENERAL TT 24-08-2026.pdf
 *
 * - Subject names are kept short/as printed in the PDF.
 * - Teacher names are the PDF initials/codes; no full names are invented.
 * - Weekly counts are counted from the Monday-Saturday timetable.
 * - LAB 1 / LAB 2 are room indicators and are removed from subject names.
 * - UI/UX remains one subject.
 *
 * BSC:
 *   FY = common
 *   SY = ZOO / Chemistry
 *   TY = ZOO / Chemistry
 *
 * BCOM(MS):
 *   FY = common
 *   SY = HR / Finance
 *   TY = HR / Finance
 *
 * Admin details are preserved.
 * The old demo subjects/teachers/classes are cleared before rebuilding this dataset.
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

  // --------------------------------------------------------------------------
  // SETTINGS - ADMIN UNCHANGED
  // --------------------------------------------------------------------------

  await prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: {
      defaultDuration: 50,
      workingDays: WORKING_DAYS,
      fullTimeStart: '08:00',
      fullTimeEnd: '14:00',
    },
    create: {
      id: 'singleton',
      collegeName: 'Hirwal Education Trust College of Science(Computer Science & Information Technology)',
      defaultDuration: 50,
      workingDays: WORKING_DAYS,
      fullTimeStart: '08:00',
      fullTimeEnd: '14:00',
      timetableStatus: 'DRAFT',
    },
  });

  // --------------------------------------------------------------------------
  // ADMIN - DO NOT CHANGE
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // REMOVE OLD DEMO DATA
  // ADMIN USER IS NOT TOUCHED.
  // --------------------------------------------------------------------------

  await prisma.subjectAllocation.deleteMany({});
  await prisma.syllabus.deleteMany({});
  await prisma.subject.deleteMany({});

  await prisma.user.deleteMany({
    where: { role: 'TEACHER' },
  });
  await prisma.teacher.deleteMany({});

  await prisma.class.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.timeSlot.deleteMany({});
  await prisma.stream.deleteMany({});
  await prisma.academicYear.deleteMany({});
  await prisma.department.deleteMany({});

  // --------------------------------------------------------------------------
  // DEPARTMENTS
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // STREAMS
  // --------------------------------------------------------------------------

  const streamDefs = [
    { name: 'BSCIT', code: 'BSCIT', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 1 },
    { name: 'BSCCS', code: 'BSCCS', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 2 },
    { name: 'BSC', code: 'BSC', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 3 },
    { name: 'BCOM', code: 'BCOM', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 4 },
    { name: 'BCOM(MS)', code: 'BCOMMS', yearStructure: 'UG_THREE_YEAR' as const, displayOrder: 5 },
    { name: '5-Year LLB', code: 'LLB', yearStructure: 'LLB_FIVE_YEAR' as const, displayOrder: 6 },
  ];

  const streams: Record<string, string> = {};

  for (const def of streamDefs) {
    const row = await prisma.stream.upsert({
      where: { code: def.code },
      update: {},
      create: def,
    });
    streams[def.code] = row.id;
  }

  const ay = await prisma.academicYear.upsert({
    where: { label: '2026-27' },
    update: { isActive: true },
    create: { label: '2026-27', isActive: true },
  });

  // --------------------------------------------------------------------------
  // CLASSES
  // --------------------------------------------------------------------------

  const classDefs = [
    { streamCode: 'BSCIT', year: 'FY', semester: 1, division: 'A' },
    { streamCode: 'BSCIT', year: 'SY', semester: 3, division: 'A' },
    { streamCode: 'BSCIT', year: 'TY', semester: 5, division: 'A' },

    { streamCode: 'BSCCS', year: 'FY', semester: 1, division: 'A' },
    { streamCode: 'BSCCS', year: 'SY', semester: 3, division: 'A' },
    { streamCode: 'BSCCS', year: 'TY', semester: 5, division: 'A' },

    { streamCode: 'BSC', year: 'FY', semester: 1, division: 'A' },
    { streamCode: 'BSC', year: 'SY', semester: 3, division: 'ZOO' },
    { streamCode: 'BSC', year: 'SY', semester: 3, division: 'Chemistry' },
    { streamCode: 'BSC', year: 'TY', semester: 5, division: 'ZOO' },
    { streamCode: 'BSC', year: 'TY', semester: 5, division: 'Chemistry' },

    { streamCode: 'BCOM', year: 'FY', semester: 1, division: 'A' },
    { streamCode: 'BCOM', year: 'SY', semester: 3, division: 'A' },
    { streamCode: 'BCOM', year: 'TY', semester: 5, division: 'A' },

    { streamCode: 'BCOMMS', year: 'FY', semester: 1, division: 'A' },
    { streamCode: 'BCOMMS', year: 'SY', semester: 3, division: 'HR' },
    { streamCode: 'BCOMMS', year: 'SY', semester: 3, division: 'Finance' },
    { streamCode: 'BCOMMS', year: 'TY', semester: 5, division: 'HR' },
    { streamCode: 'BCOMMS', year: 'TY', semester: 5, division: 'Finance' },

    { streamCode: 'LLB', year: 'Year 1', semester: 1, division: 'A' },
    { streamCode: 'LLB', year: 'Year 2', semester: 3, division: 'A' },
    { streamCode: 'LLB', year: 'Year 3', semester: 5, division: 'A' },
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

  // --------------------------------------------------------------------------
  // ROOMS
  // --------------------------------------------------------------------------

  const roomDefs = [
    { name: 'Room 101', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 102', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 103', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 201', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 202', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 203', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 301', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 302', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 303', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 401', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 402', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 403', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 404', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 405', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 501', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 502', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 503', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 504', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Room 505', type: 'CLASSROOM' as const, capacity: 70 },
    { name: 'Computer Lab 1', type: 'LAB' as const, capacity: 35 },
    { name: 'Computer Lab 2', type: 'LAB' as const, capacity: 35 },
    { name: 'Chemistry Lab', type: 'LAB' as const, capacity: 35 },
    { name: 'Zoology Lab', type: 'LAB' as const, capacity: 35 },
    { name: 'Seminar Hall', type: 'SEMINAR' as const, capacity: 150 },
  ];

  const rooms: Record<string, string> = {};

  for (const def of roomDefs) {
    const row = await prisma.room.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
    rooms[def.name] = row.id;
  }

  // --------------------------------------------------------------------------
  // TIME
  // --------------------------------------------------------------------------

  const slotDefs = [
    { startTime: '08:00', endTime: '08:50', type: 'LECTURE' as const, displayOrder: 1 },
    { startTime: '08:50', endTime: '09:40', type: 'LECTURE' as const, displayOrder: 2 },
    { startTime: '09:40', endTime: '10:30', type: 'LECTURE' as const, displayOrder: 3 },
    { startTime: '10:30', endTime: '10:50', type: 'BREAK' as const, displayOrder: 4 },
    { startTime: '10:50', endTime: '11:40', type: 'LECTURE' as const, displayOrder: 5 },
    { startTime: '11:40', endTime: '12:30', type: 'LECTURE' as const, displayOrder: 6 },
    { startTime: '12:30', endTime: '13:20', type: 'LECTURE' as const, displayOrder: 7 },
    { startTime: '13:20', endTime: '13:50', type: 'LUNCH' as const, displayOrder: 8 },
  ];

  for (const def of slotDefs) {
    await prisma.timeSlot.upsert({
      where: {
        startTime_endTime: {
          startTime: def.startTime,
          endTime: def.endTime,
        },
      },
      update: { type: def.type, displayOrder: def.displayOrder },
      create: def,
    });
  }

  // --------------------------------------------------------------------------
  // TEACHERS - ONLY PDF INITIALS/CODES
  // --------------------------------------------------------------------------

  const teacherCodes: string[] = ["AG", "AI", "AP", "HP", "HV", "JVP", "KD", "KG", "MA", "MMA", "MP", "MVP", "NS", "PJ", "RSW", "SK", "SN", "SNK", "SP", "TD", "TJ", "VN", "VS"];

  const teachers: Record<string, string> = {};

  for (const code of teacherCodes) {
    const isCommerce = ['SP', 'MVP', 'SK', 'PJ', 'JVP', 'TD', 'VS', 'MA'].includes(code);
    const departmentId = isCommerce ? deptCom.id : deptCS.id;
    const email = `${code.toLowerCase()}@college.edu`;

    const row = await prisma.teacher.upsert({
      where: { teacherCode: `PDF-${code}` },
      update: {
        name: code,
        email,
        departmentId,
        designation: 'Faculty',
        qualification: code,
        employmentType: 'FULL_TIME',
        maxWeeklyLectures: 30,
        maxDailyLectures: 6,
      },
      create: {
        teacherCode: `PDF-${code}`,
        name: code,
        email,
        departmentId,
        designation: 'Faculty',
        qualification: code,
        employmentType: 'FULL_TIME',
        maxWeeklyLectures: 30,
        maxDailyLectures: 6,
        availability: {
          create: WORKING_DAYS.map((day) => ({
            day,
            startTime: '08:00',
            endTime: '14:00',
          })),
        },
      },
    });

    teachers[code] = row.id;

    await prisma.user.upsert({
      where: { email },
      update: {
        name: code,
        role: 'TEACHER',
        isActive: true,
        teacherId: row.id,
      },
      create: {
        email,
        name: code,
        role: 'TEACHER',
        passwordHash: await bcrypt.hash(teacherPassword, 10),
        teacherId: row.id,
      },
    });
  }

  // --------------------------------------------------------------------------
  // SUBJECTS FROM PDF
  // --------------------------------------------------------------------------

  const subjectDefs: Array<{
    code: string;
    name: string;
    stream: string;
    year: string;
    weekly: number;
    teacher: string;
  }> = [{"code": "IT-FY__0", "name": "CSD", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "MMA"}, {"code": "IT-FY__1", "name": "DBMS", "stream": "BSCIT", "year": "FY", "weekly": 5, "teacher": "SNK"}, {"code": "IT-FY__2", "name": "EM", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "VS"}, {"code": "IT-FY__3", "name": "EMSD", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "AP"}, {"code": "IT-FY__4", "name": "ICS", "stream": "BSCIT", "year": "FY", "weekly": 1, "teacher": "TD"}, {"code": "IT-FY__5", "name": "IKS", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "NS"}, {"code": "IT-FY__6", "name": "Intro to Comm", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "VS"}, {"code": "IT-FY__7", "name": "NSS", "stream": "BSCIT", "year": "FY", "weekly": 1, "teacher": "KG"}, {"code": "IT-FY__8", "name": "OTDM", "stream": "BSCIT", "year": "FY", "weekly": 2, "teacher": "TJ"}, {"code": "IT-FY__9", "name": "Prog. With C", "stream": "BSCIT", "year": "FY", "weekly": 5, "teacher": "VN"}, {"code": "IT-SY__0", "name": "AM", "stream": "BSCIT", "year": "SY", "weekly": 3, "teacher": "KG"}, {"code": "IT-SY__1", "name": "DS", "stream": "BSCIT", "year": "SY", "weekly": 5, "teacher": "AG"}, {"code": "IT-SY__2", "name": "HWM", "stream": "BSCIT", "year": "SY", "weekly": 3, "teacher": "HV"}, {"code": "IT-SY__3", "name": "NSS", "stream": "BSCIT", "year": "SY", "weekly": 1, "teacher": "KG"}, {"code": "IT-SY__4", "name": "OS", "stream": "BSCIT", "year": "SY", "weekly": 3, "teacher": "RSW"}, {"code": "IT-SY__5", "name": "PYTHON", "stream": "BSCIT", "year": "SY", "weekly": 5, "teacher": "VN"}, {"code": "IT-SY__6", "name": "URDU", "stream": "BSCIT", "year": "SY", "weekly": 1, "teacher": "MA"}, {"code": "IT-SY__7", "name": "WEB", "stream": "BSCIT", "year": "SY", "weekly": 5, "teacher": "AG"}, {"code": "IT-TY__0", "name": ".NET", "stream": "BSCIT", "year": "TY", "weekly": 5, "teacher": "TJ"}, {"code": "IT-TY__1", "name": "AI", "stream": "BSCIT", "year": "TY", "weekly": 5, "teacher": "KG"}, {"code": "IT-TY__2", "name": "CS", "stream": "BSCIT", "year": "TY", "weekly": 2, "teacher": "HV"}, {"code": "IT-TY__3", "name": "CS Pract", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "MMA"}, {"code": "IT-TY__4", "name": "E.JAVA", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "RSW"}, {"code": "IT-TY__5", "name": "IKS", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "MMA"}, {"code": "IT-TY__6", "name": "IOT", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "VN"}, {"code": "IT-TY__7", "name": "MERN STACK", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "AG"}, {"code": "BCS-FY__0", "name": "DSA", "stream": "BSCCS", "year": "FY", "weekly": 5, "teacher": "TJ"}, {"code": "BCS-FY__1", "name": "EM", "stream": "BSCCS", "year": "FY", "weekly": 1, "teacher": "AG"}, {"code": "BCS-FY__2", "name": "EMSD", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "NS"}, {"code": "BCS-FY__3", "name": "FDS", "stream": "BSCCS", "year": "FY", "weekly": 5, "teacher": "SNK"}, {"code": "BCS-FY__4", "name": "ICS", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "TD"}, {"code": "BCS-FY__5", "name": "IKS", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "KD"}, {"code": "BCS-FY__6", "name": "Intro to Comm", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "AI"}, {"code": "BCS-FY__7", "name": "NSS", "stream": "BSCCS", "year": "FY", "weekly": 1, "teacher": "KG"}, {"code": "BCS-FY__8", "name": "PYTHON", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "VN"}, {"code": "BCS-FY__9", "name": "STAT WITH R", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "KG"}, {"code": "BCS-SY__0", "name": "BIG DATA", "stream": "BSCCS", "year": "SY", "weekly": 2, "teacher": "KG"}, {"code": "BCS-SY__1", "name": "DS", "stream": "BSCCS", "year": "SY", "weekly": 4, "teacher": "HV"}, {"code": "BCS-SY__2", "name": "HWM", "stream": "BSCCS", "year": "SY", "weekly": 3, "teacher": "HV"}, {"code": "BCS-SY__3", "name": "ITDA", "stream": "BSCCS", "year": "SY", "weekly": 3, "teacher": "MMA"}, {"code": "BCS-SY__4", "name": "JAVA", "stream": "BSCCS", "year": "SY", "weekly": 4, "teacher": "RSW"}, {"code": "BCS-SY__5", "name": "MARATHI", "stream": "BSCCS", "year": "SY", "weekly": 1, "teacher": "MMA"}, {"code": "BCS-SY__6", "name": "NSS", "stream": "BSCCS", "year": "SY", "weekly": 1, "teacher": "KG"}, {"code": "BCS-SY__7", "name": "OS", "stream": "BSCCS", "year": "SY", "weekly": 5, "teacher": "AG"}, {"code": "BCS-SY__8", "name": "R DS", "stream": "BSCCS", "year": "SY", "weekly": 1, "teacher": "HV"}, {"code": "BCS-SY__9", "name": "TOC", "stream": "BSCCS", "year": "SY", "weekly": 3, "teacher": "TJ"}, {"code": "BCS-SY__10", "name": "URDU", "stream": "BSCCS", "year": "SY", "weekly": 1, "teacher": "MA"}, {"code": "BCS-TY__0", "name": "AI", "stream": "BSCCS", "year": "TY", "weekly": 5, "teacher": "KG"}, {"code": "BCS-TY__1", "name": "CIS", "stream": "BSCCS", "year": "TY", "weekly": 6, "teacher": "RSW"}, {"code": "BCS-TY__2", "name": "EH", "stream": "BSCCS", "year": "TY", "weekly": 3, "teacher": "HV"}, {"code": "BCS-TY__3", "name": "IKS", "stream": "BSCCS", "year": "TY", "weekly": 3, "teacher": "TJ"}, {"code": "BCS-TY__4", "name": "LINUX", "stream": "BSCCS", "year": "TY", "weekly": 4, "teacher": "AG"}, {"code": "BCS-TY__5", "name": "WSN", "stream": "BSCCS", "year": "TY", "weekly": 5, "teacher": "VN"}, {"code": "BSC-FY__0", "name": "AM", "stream": "BSC", "year": "FY", "weekly": 1, "teacher": "HP"}, {"code": "BSC-FY__1", "name": "AM PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "HP"}, {"code": "BSC-FY__2", "name": "BPIO", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "KD"}, {"code": "BSC-FY__3", "name": "BPIO PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "KD"}, {"code": "BSC-FY__4", "name": "CGI", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "NS"}, {"code": "BSC-FY__5", "name": "EMSD", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "AP"}, {"code": "BSC-FY__6", "name": "ICS", "stream": "BSC", "year": "FY", "weekly": 1, "teacher": "TD"}, {"code": "BSC-FY__7", "name": "IKS", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "MA"}, {"code": "BSC-FY__8", "name": "LP", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "SN"}, {"code": "BSC-FY__9", "name": "LP PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "SN"}, {"code": "BSC-FY__10", "name": "PSHW", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "MA"}, {"code": "BSC-FY__11", "name": "PSHW PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "MA"}, {"code": "BSC-SY__0", "name": "Cytology", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "SN"}, {"code": "BSC-SY__1", "name": "Cytology Pract", "stream": "BSC", "year": "SY", "weekly": 1, "teacher": "SN"}, {"code": "BSC-SY__2", "name": "DLLE", "stream": "BSC", "year": "SY", "weekly": 1, "teacher": "HV"}, {"code": "BSC-SY__3", "name": "FFB", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "AI"}, {"code": "BSC-SY__4", "name": "MARATHI", "stream": "BSC", "year": "SY", "weekly": 1, "teacher": "AP"}, {"code": "BSC-SY__5", "name": "PIOC", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "AP"}, {"code": "BSC-SY__6", "name": "PIOC PRACT", "stream": "BSC", "year": "SY", "weekly": 2, "teacher": "AP"}, {"code": "BSC-SY__7", "name": "PPAC", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "KD"}, {"code": "BSC-SY__8", "name": "PPAC PRACT", "stream": "BSC", "year": "SY", "weekly": 2, "teacher": "KD"}, {"code": "BSC-SY__9", "name": "SIC", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "NS"}, {"code": "BSC-SY__10", "name": "URDU", "stream": "BSC", "year": "SY", "weekly": 1, "teacher": "MA"}, {"code": "BSC-TY__0", "name": "AAIC / H&I", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "KD"}, {"code": "BSC-TY__1", "name": "AAIC /NCT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "KD"}, {"code": "BSC-TY__2", "name": "AC/CC", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "HP"}, {"code": "BSC-TY__3", "name": "AC/CC PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "HP"}, {"code": "BSC-TY__4", "name": "AIOC/H&I", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "AP"}, {"code": "BSC-TY__5", "name": "AIOC/NCT", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "AP"}, {"code": "BSC-TY__6", "name": "APAC / SERICULTURE", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "KD"}, {"code": "BSC-TY__7", "name": "D&D PRACT/MD PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "NS"}, {"code": "BSC-TY__8", "name": "D&D/MD", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "NS"}, {"code": "BSC-TY__9", "name": "DLLE", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "HV"}, {"code": "BSC-TY__10", "name": "IKS/ZIKS", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "NS"}, {"code": "BSC-TY__11", "name": "MJP PRACT/NCT PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "KD"}, {"code": "BSC-TY__12", "name": "TCAS PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "AP"}, {"code": "BMS-FY__0", "name": "BCS", "stream": "BCOMMS", "year": "FY", "weekly": 2, "teacher": "AG"}, {"code": "BMS-FY__1", "name": "BMS", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "SK"}, {"code": "BMS-FY__2", "name": "BSS", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "SP"}, {"code": "BMS-FY__3", "name": "DLLE", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "MVP"}, {"code": "BMS-FY__4", "name": "EMSD", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "MA"}, {"code": "BMS-FY__5", "name": "IKS", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "VS"}, {"code": "BMS-FY__6", "name": "ITBM", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "HV"}, {"code": "BMS-FY__7", "name": "OST", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "HV"}, {"code": "BMS-FY__8", "name": "PM", "stream": "BCOMMS", "year": "FY", "weekly": 4, "teacher": "AI"}, {"code": "BMS-FY__9", "name": "PRACT", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "VN"}, {"code": "BMS-FY__10", "name": "WD", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "VN"}, {"code": "BMS-SY__0", "name": "BL", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "PJ"}, {"code": "BMS-SY__1", "name": "DLLE", "stream": "BCOMMS", "year": "SY", "weekly": 1, "teacher": "MVP"}, {"code": "BMS-SY__2", "name": "FM / TD", "stream": "BCOMMS", "year": "SY", "weekly": 4, "teacher": "SP"}, {"code": "BMS-SY__3", "name": "FSA / RS", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "JVP"}, {"code": "BMS-SY__4", "name": "IFS / HRM", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "TD"}, {"code": "BMS-SY__5", "name": "MARATHI", "stream": "BCOMMS", "year": "SY", "weekly": 1, "teacher": "VS"}, {"code": "BMS-SY__6", "name": "UI/UX", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "MMA"}, {"code": "BMS-SY__7", "name": "URDU", "stream": "BCOMMS", "year": "SY", "weekly": 1, "teacher": "MA"}, {"code": "BMS-TY__0", "name": "BL", "stream": "BCOMMS", "year": "TY", "weekly": 4, "teacher": "PJ"}, {"code": "BMS-TY__1", "name": "CA / GP IN HRM", "stream": "BCOMMS", "year": "TY", "weekly": 3, "teacher": "JVP"}, {"code": "BMS-TY__2", "name": "CA / HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP"}, {"code": "BMS-TY__3", "name": "DT / GMC in HR", "stream": "BCOMMS", "year": "TY", "weekly": 2, "teacher": "JVP"}, {"code": "BMS-TY__4", "name": "DT / HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP"}, {"code": "BMS-TY__5", "name": "DT /P & P", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP"}, {"code": "BMS-TY__6", "name": "EFM / HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "SP"}, {"code": "BMS-TY__7", "name": "EFM / P & P", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "SP"}, {"code": "BMS-TY__8", "name": "EFM /SHRM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "SP"}, {"code": "BMS-TY__9", "name": "IAPM / P & P", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP"}, {"code": "BMS-TY__10", "name": "IAPM / SHRM", "stream": "BCOMMS", "year": "TY", "weekly": 3, "teacher": "JVP"}, {"code": "BMS-TY__11", "name": "WM / GMC in HR", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MP"}, {"code": "BMS-TY__12", "name": "WM / GP IN HRM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MP"}, {"code": "BMS-TY__13", "name": "WM /HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MP"}, {"code": "BCOM-FY__0", "name": "AFM", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "SK"}, {"code": "BCOM-FY__1", "name": "BCS", "stream": "BCOM", "year": "FY", "weekly": 2, "teacher": "TD"}, {"code": "BCOM-FY__2", "name": "COMM - I", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "MVP"}, {"code": "BCOM-FY__3", "name": "DLLE", "stream": "BCOM", "year": "FY", "weekly": 1, "teacher": "SK"}, {"code": "BCOM-FY__4", "name": "EMSD", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "MA"}, {"code": "BCOM-FY__5", "name": "FM", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "TD"}, {"code": "BCOM-FY__6", "name": "FSU", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "AI"}, {"code": "BCOM-FY__7", "name": "IKS", "stream": "BCOM", "year": "FY", "weekly": 2, "teacher": "MA"}, {"code": "BCOM-FY__8", "name": "NS", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "TD"}, {"code": "BCOM-FY__9", "name": "OST", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "HV"}, {"code": "BCOM-FY__10", "name": "WD", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "VN"}, {"code": "BCOM-SY__0", "name": "A & A", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "SP"}, {"code": "BCOM-SY__1", "name": "ADVT", "stream": "BCOM", "year": "SY", "weekly": 1, "teacher": "SP"}, {"code": "BCOM-SY__2", "name": "AFM", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "JVP"}, {"code": "BCOM-SY__3", "name": "BL", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "PJ"}, {"code": "BCOM-SY__4", "name": "COMM - III", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "MVP"}, {"code": "BCOM-SY__5", "name": "FBM", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "SK"}, {"code": "BCOM-SY__6", "name": "MARATHI", "stream": "BCOM", "year": "SY", "weekly": 2, "teacher": "VS"}, {"code": "BCOM-SY__7", "name": "UI/UX", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "MMA"}, {"code": "BCOM-SY__8", "name": "URDU", "stream": "BCOM", "year": "SY", "weekly": 1, "teacher": "MA"}, {"code": "BCOM-TY__0", "name": "Account", "stream": "BCOM", "year": "TY", "weekly": 6, "teacher": "SP"}, {"code": "BCOM-TY__1", "name": "BL", "stream": "BCOM", "year": "TY", "weekly": 4, "teacher": "PJ"}, {"code": "BCOM-TY__2", "name": "COMM - V", "stream": "BCOM", "year": "TY", "weekly": 4, "teacher": "MVP"}, {"code": "BCOM-TY__3", "name": "IAPM", "stream": "BCOM", "year": "TY", "weekly": 3, "teacher": "JVP"}, {"code": "BCOM-TY__4", "name": "IKS", "stream": "BCOM", "year": "TY", "weekly": 2, "teacher": "MVP"}, {"code": "BCOM-TY__5", "name": "P&SK", "stream": "BCOM", "year": "TY", "weekly": 4, "teacher": "SK"}];

  const subjects: Record<string, string> = {};

  for (const def of subjectDefs) {
    const semester = def.year === 'FY' ? 1 : def.year === 'SY' ? 3 : 5;
    const practical = /PRACT|LAB/i.test(def.name);

    const row = await prisma.subject.upsert({
      where: { code: def.code },
      update: {
        name: def.name,
        streamId: streams[def.stream],
        year: def.year,
        semester,
        type: practical ? 'PRACTICAL' : 'THEORY',
        weeklyLectures: def.weekly,
        durationMinutes: 50,
        roomType: practical ? 'LAB' : 'CLASSROOM',
        credits: 1,
      },
      create: {
        code: def.code,
        name: def.name,
        streamId: streams[def.stream],
        year: def.year,
        semester,
        type: practical ? 'PRACTICAL' : 'THEORY',
        weeklyLectures: def.weekly,
        durationMinutes: 50,
        roomType: practical ? 'LAB' : 'CLASSROOM',
        credits: 1,
      },
    });

    subjects[def.code] = row.id;
  }

  // --------------------------------------------------------------------------
  // ALLOCATIONS
  // --------------------------------------------------------------------------

  const allocationDefs: Array<{
    subjectCode: string;
    classKeys: string[];
    weekly: number;
    teacher: string;
  }> = [{"subjectCode": "IT-FY__0", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "IT-FY__1", "classKeys": ["BSCIT-FY-A"], "weekly": 5, "teacher": "SNK"}, {"subjectCode": "IT-FY__2", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "VS"}, {"subjectCode": "IT-FY__3", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "AP"}, {"subjectCode": "IT-FY__4", "classKeys": ["BSCIT-FY-A"], "weekly": 1, "teacher": "TD"}, {"subjectCode": "IT-FY__5", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "IT-FY__6", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "VS"}, {"subjectCode": "IT-FY__7", "classKeys": ["BSCIT-FY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "IT-FY__8", "classKeys": ["BSCIT-FY-A"], "weekly": 2, "teacher": "TJ"}, {"subjectCode": "IT-FY__9", "classKeys": ["BSCIT-FY-A"], "weekly": 5, "teacher": "VN"}, {"subjectCode": "IT-SY__0", "classKeys": ["BSCIT-SY-A"], "weekly": 3, "teacher": "KG"}, {"subjectCode": "IT-SY__1", "classKeys": ["BSCIT-SY-A"], "weekly": 5, "teacher": "AG"}, {"subjectCode": "IT-SY__2", "classKeys": ["BSCIT-SY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "IT-SY__3", "classKeys": ["BSCIT-SY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "IT-SY__4", "classKeys": ["BSCIT-SY-A"], "weekly": 3, "teacher": "RSW"}, {"subjectCode": "IT-SY__5", "classKeys": ["BSCIT-SY-A"], "weekly": 5, "teacher": "VN"}, {"subjectCode": "IT-SY__6", "classKeys": ["BSCIT-SY-A"], "weekly": 1, "teacher": "MA"}, {"subjectCode": "IT-SY__7", "classKeys": ["BSCIT-SY-A"], "weekly": 5, "teacher": "AG"}, {"subjectCode": "IT-TY__0", "classKeys": ["BSCIT-TY-A"], "weekly": 5, "teacher": "TJ"}, {"subjectCode": "IT-TY__1", "classKeys": ["BSCIT-TY-A"], "weekly": 5, "teacher": "KG"}, {"subjectCode": "IT-TY__2", "classKeys": ["BSCIT-TY-A"], "weekly": 2, "teacher": "HV"}, {"subjectCode": "IT-TY__3", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "IT-TY__4", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "RSW"}, {"subjectCode": "IT-TY__5", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "IT-TY__6", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "VN"}, {"subjectCode": "IT-TY__7", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "AG"}, {"subjectCode": "BCS-FY__0", "classKeys": ["BSCCS-FY-A"], "weekly": 5, "teacher": "TJ"}, {"subjectCode": "BCS-FY__1", "classKeys": ["BSCCS-FY-A"], "weekly": 1, "teacher": "AG"}, {"subjectCode": "BCS-FY__2", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BCS-FY__3", "classKeys": ["BSCCS-FY-A"], "weekly": 5, "teacher": "SNK"}, {"subjectCode": "BCS-FY__4", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "TD"}, {"subjectCode": "BCS-FY__5", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BCS-FY__6", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BCS-FY__7", "classKeys": ["BSCCS-FY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BCS-FY__8", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "VN"}, {"subjectCode": "BCS-FY__9", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "KG"}, {"subjectCode": "BCS-SY__0", "classKeys": ["BSCCS-SY-A"], "weekly": 2, "teacher": "KG"}, {"subjectCode": "BCS-SY__1", "classKeys": ["BSCCS-SY-A"], "weekly": 4, "teacher": "HV"}, {"subjectCode": "BCS-SY__2", "classKeys": ["BSCCS-SY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BCS-SY__3", "classKeys": ["BSCCS-SY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BCS-SY__4", "classKeys": ["BSCCS-SY-A"], "weekly": 4, "teacher": "RSW"}, {"subjectCode": "BCS-SY__5", "classKeys": ["BSCCS-SY-A"], "weekly": 1, "teacher": "MMA"}, {"subjectCode": "BCS-SY__6", "classKeys": ["BSCCS-SY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BCS-SY__7", "classKeys": ["BSCCS-SY-A"], "weekly": 5, "teacher": "AG"}, {"subjectCode": "BCS-SY__8", "classKeys": ["BSCCS-SY-A"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BCS-SY__9", "classKeys": ["BSCCS-SY-A"], "weekly": 3, "teacher": "TJ"}, {"subjectCode": "BCS-SY__10", "classKeys": ["BSCCS-SY-A"], "weekly": 1, "teacher": "MA"}, {"subjectCode": "BCS-TY__0", "classKeys": ["BSCCS-TY-A"], "weekly": 5, "teacher": "KG"}, {"subjectCode": "BCS-TY__1", "classKeys": ["BSCCS-TY-A"], "weekly": 6, "teacher": "RSW"}, {"subjectCode": "BCS-TY__2", "classKeys": ["BSCCS-TY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BCS-TY__3", "classKeys": ["BSCCS-TY-A"], "weekly": 3, "teacher": "TJ"}, {"subjectCode": "BCS-TY__4", "classKeys": ["BSCCS-TY-A"], "weekly": 4, "teacher": "AG"}, {"subjectCode": "BCS-TY__5", "classKeys": ["BSCCS-TY-A"], "weekly": 5, "teacher": "VN"}, {"subjectCode": "BSC-FY__0", "classKeys": ["BSC-FY-A"], "weekly": 1, "teacher": "HP"}, {"subjectCode": "BSC-FY__1", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "HP"}, {"subjectCode": "BSC-FY__2", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BSC-FY__3", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC-FY__4", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "NS"}, {"subjectCode": "BSC-FY__5", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "AP"}, {"subjectCode": "BSC-FY__6", "classKeys": ["BSC-FY-A"], "weekly": 1, "teacher": "TD"}, {"subjectCode": "BSC-FY__7", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BSC-FY__8", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "SN"}, {"subjectCode": "BSC-FY__9", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "SN"}, {"subjectCode": "BSC-FY__10", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BSC-FY__11", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "MA"}, {"subjectCode": "BSC-SY__0", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "SN"}, {"subjectCode": "BSC-SY__1", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 1, "teacher": "SN"}, {"subjectCode": "BSC-SY__2", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BSC-SY__3", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BSC-SY__4", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 1, "teacher": "AP"}, {"subjectCode": "BSC-SY__5", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "AP"}, {"subjectCode": "BSC-SY__6", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 2, "teacher": "AP"}, {"subjectCode": "BSC-SY__7", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BSC-SY__8", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC-SY__9", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSC-SY__10", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 1, "teacher": "MA"}, {"subjectCode": "BSC-TY__0", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 1, "teacher": "KD"}, {"subjectCode": "BSC-TY__1", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC-TY__2", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 1, "teacher": "HP"}, {"subjectCode": "BSC-TY__3", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 2, "teacher": "HP"}, {"subjectCode": "BSC-TY__4", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 2, "teacher": "AP"}, {"subjectCode": "BSC-TY__5", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 1, "teacher": "AP"}, {"subjectCode": "BSC-TY__6", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BSC-TY__7", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 2, "teacher": "NS"}, {"subjectCode": "BSC-TY__8", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSC-TY__9", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BSC-TY__10", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSC-TY__11", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC-TY__12", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 2, "teacher": "AP"}, {"subjectCode": "BMS-FY__0", "classKeys": ["BCOMMS-FY-A"], "weekly": 2, "teacher": "AG"}, {"subjectCode": "BMS-FY__1", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BMS-FY__2", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "SP"}, {"subjectCode": "BMS-FY__3", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "MVP"}, {"subjectCode": "BMS-FY__4", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BMS-FY__5", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "VS"}, {"subjectCode": "BMS-FY__6", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BMS-FY__7", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BMS-FY__8", "classKeys": ["BCOMMS-FY-A"], "weekly": 4, "teacher": "AI"}, {"subjectCode": "BMS-FY__9", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "VN"}, {"subjectCode": "BMS-FY__10", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "VN"}, {"subjectCode": "BMS-SY__0", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 3, "teacher": "PJ"}, {"subjectCode": "BMS-SY__1", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 1, "teacher": "MVP"}, {"subjectCode": "BMS-SY__2", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 4, "teacher": "SP"}, {"subjectCode": "BMS-SY__3", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BMS-SY__4", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 3, "teacher": "TD"}, {"subjectCode": "BMS-SY__5", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 1, "teacher": "VS"}, {"subjectCode": "BMS-SY__6", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BMS-SY__7", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 1, "teacher": "MA"}, {"subjectCode": "BMS-TY__0", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 4, "teacher": "PJ"}, {"subjectCode": "BMS-TY__1", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BMS-TY__2", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS-TY__3", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 2, "teacher": "JVP"}, {"subjectCode": "BMS-TY__4", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS-TY__5", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS-TY__6", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BMS-TY__7", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BMS-TY__8", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BMS-TY__9", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS-TY__10", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BMS-TY__11", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "MP"}, {"subjectCode": "BMS-TY__12", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "MP"}, {"subjectCode": "BMS-TY__13", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "MP"}, {"subjectCode": "BCOM-FY__0", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BCOM-FY__1", "classKeys": ["BCOM-FY-A"], "weekly": 2, "teacher": "TD"}, {"subjectCode": "BCOM-FY__2", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "MVP"}, {"subjectCode": "BCOM-FY__3", "classKeys": ["BCOM-FY-A"], "weekly": 1, "teacher": "SK"}, {"subjectCode": "BCOM-FY__4", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BCOM-FY__5", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "TD"}, {"subjectCode": "BCOM-FY__6", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BCOM-FY__7", "classKeys": ["BCOM-FY-A"], "weekly": 2, "teacher": "MA"}, {"subjectCode": "BCOM-FY__8", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "TD"}, {"subjectCode": "BCOM-FY__9", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BCOM-FY__10", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "VN"}, {"subjectCode": "BCOM-SY__0", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "SP"}, {"subjectCode": "BCOM-SY__1", "classKeys": ["BCOM-SY-A"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BCOM-SY__2", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BCOM-SY__3", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "PJ"}, {"subjectCode": "BCOM-SY__4", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "MVP"}, {"subjectCode": "BCOM-SY__5", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BCOM-SY__6", "classKeys": ["BCOM-SY-A"], "weekly": 2, "teacher": "VS"}, {"subjectCode": "BCOM-SY__7", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BCOM-SY__8", "classKeys": ["BCOM-SY-A"], "weekly": 1, "teacher": "MA"}, {"subjectCode": "BCOM-TY__0", "classKeys": ["BCOM-TY-A"], "weekly": 6, "teacher": "SP"}, {"subjectCode": "BCOM-TY__1", "classKeys": ["BCOM-TY-A"], "weekly": 4, "teacher": "PJ"}, {"subjectCode": "BCOM-TY__2", "classKeys": ["BCOM-TY-A"], "weekly": 4, "teacher": "MVP"}, {"subjectCode": "BCOM-TY__3", "classKeys": ["BCOM-TY-A"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BCOM-TY__4", "classKeys": ["BCOM-TY-A"], "weekly": 2, "teacher": "MVP"}, {"subjectCode": "BCOM-TY__5", "classKeys": ["BCOM-TY-A"], "weekly": 4, "teacher": "SK"}];

  const classRoomMap: Record<string, string> = {
    'BSCIT-FY-A': 'Room 101', 'BSCIT-SY-A': 'Room 102', 'BSCIT-TY-A': 'Room 103',
    'BSCCS-FY-A': 'Room 201', 'BSCCS-SY-A': 'Room 202', 'BSCCS-TY-A': 'Room 203',
    'BCOM-FY-A': 'Room 301', 'BCOM-SY-A': 'Room 302', 'BCOM-TY-A': 'Room 303',
    'BSC-FY-A': 'Room 401', 'BSC-SY-ZOO': 'Room 402', 'BSC-SY-Chemistry': 'Room 403',
    'BSC-TY-ZOO': 'Room 404', 'BSC-TY-Chemistry': 'Room 405',
    'BCOMMS-FY-A': 'Room 501', 'BCOMMS-SY-HR': 'Room 502', 'BCOMMS-SY-Finance': 'Room 503',
    'BCOMMS-TY-HR': 'Room 504', 'BCOMMS-TY-Finance': 'Room 505',
  };

  function roomFor(classKey: string, subjectName: string): string {
    const practical = /PRACT|LAB/i.test(subjectName);
    if (practical && (classKey.includes('BSC-SY-ZOO') || classKey.includes('BSC-TY-ZOO'))) return 'Zoology Lab';
    if (practical && (classKey.includes('BSC-SY-Chemistry') || classKey.includes('BSC-TY-Chemistry'))) return 'Chemistry Lab';
    if (practical && (classKey.startsWith('BSCIT-') || classKey.startsWith('BSCCS-') || classKey.startsWith('BCOM-') || classKey.startsWith('BCOMMS-'))) return 'Computer Lab 1';
    return classRoomMap[classKey] ?? 'Seminar Hall';
  }

  for (const def of allocationDefs) {
    for (const classKey of def.classKeys) {
      const classId = classes[classKey];
      const subjectId = subjects[def.subjectCode];
      const teacherId = teachers[def.teacher];

      if (!classId || !subjectId || !teacherId) {
        continue;
      }

      const subjectName = subjectDefs.find((s) => s.code === def.subjectCode)?.name ?? '';
      const assignedRoom = roomFor(classKey, subjectName);

      await prisma.subjectAllocation.upsert({
        where: { subjectId_classId: { subjectId, classId } },
        update: { teacherId, roomId: rooms[assignedRoom], weeklyLectures: def.weekly, durationMinutes: 50 },
        create: { subjectId, classId, teacherId, roomId: rooms[assignedRoom], weeklyLectures: def.weekly, durationMinutes: 50 },
      });
    }
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

  console.log('\n✓ PDF-based seed completed.');
  console.log(counts);

  console.log('\nRules:');
  console.log('  Teachers: 08:00 - 14:00');
  console.log('  Lectures: 50 minutes');
  console.log('  Recess:   10:30 - 10:50');
  console.log('  Lunch:    13:20 - 13:50');

  console.log('\nAdmin:');
  console.log(`  ${adminEmail} / ${adminPassword}`);

  console.log('\nTeacher login format:');
  console.log(`  <pdf-initials-lowercase>@college.edu / ${teacherPassword}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
