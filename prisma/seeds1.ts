/**
 * College timetable seed based on the existing seed + Class wise.xlsx
 *
 * - Subject names are preserved from the existing seed/Excel.
 * - Teacher names are the PDF initials/codes; no full names are invented.
 * - Weekly counts are counted from the Monday-Saturday timetable.
 * - LAB 1 / LAB 2 are actual subjects for IT, CS, B.Com and B.Com (MS).
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
 * - Subject codes use stream + year numbering: FY=101, SY=201, TY=301, followed by the subject short name.
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

  // Unique subject colors used by the timetable UI.
  // Colors are assigned deterministically, so the same subject keeps the same color.
  const SUBJECT_COLORS = [
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
    '#D7BAFF', '#FFC6FF', '#BDE0FE', '#CDEAC0', '#FDE2E4',
    '#F1C0E8', '#CFBAF0', '#90DBF4', '#8EECF5', '#98F5E1',
    '#B9FBC0', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF',
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFADAD', '#FFD6A5',
    '#E2F0CB', '#B5EAD7', '#C7CEEA', '#F8C8DC', '#D4A5A5',
  ];

  // BMS SY/TY and Plain B.Sc. SY/TY division rule:
  //   BMS: text before "/" = HR, text after "/" = Finance.
  //   B.Sc.: text before "/" = Zoology, text after "/" = Chemistry.
  // Each division-specific subject has its own teacher, allocation and color.
  // UI/UX remains a single subject because it is a subject name, not a division pair.
  const subjectDefs: Array<{
    code: string;
    name: string;
    stream: string;
    year: string;
    weekly: number;
    teacher: string;
    color?: string;
  }> = [{"code": "BSCIT101_CSD", "name": "CSD", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "MMA", "color": "#FFADAD"}, {"code": "BSCIT101_DBMS", "name": "DBMS", "stream": "BSCIT", "year": "FY", "weekly": 5, "teacher": "SNK", "color": "#CDEAC0"}, {"code": "BSCIT101_EM", "name": "EM", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "VS", "color": "#F1C0E8"}, {"code": "BSCIT101_EMSD", "name": "EMSD", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "AP", "color": "#CFBAF0"}, {"code": "BSCIT101_ICS", "name": "ICS", "stream": "BSCIT", "year": "FY", "weekly": 1, "teacher": "TD", "color": "#D4A5A5"}, {"code": "BSCIT101_IKS", "name": "IKS", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "NS", "color": "#D7BAFF"}, {"code": "BSCIT101_INTRO_TO_COMM", "name": "Intro to Comm", "stream": "BSCIT", "year": "FY", "weekly": 3, "teacher": "VS", "color": "#8EECF5"}, {"code": "BSCIT101_NSS", "name": "NSS", "stream": "BSCIT", "year": "FY", "weekly": 1, "teacher": "KG", "color": "#CAFFBF"}, {"code": "BSCIT101_OTDM", "name": "OTDM", "stream": "BSCIT", "year": "FY", "weekly": 2, "teacher": "TJ", "color": "#FFADAD"}, {"code": "BSCIT101_PROG_W_C", "name": "Prog. With C", "stream": "BSCIT", "year": "FY", "weekly": 5, "teacher": "VN", "color": "#F1C0E8"}, {"code": "BSCIT201_AM", "name": "AM", "stream": "BSCIT", "year": "SY", "weekly": 3, "teacher": "KG", "color": "#BDE0FE"}, {"code": "BSCIT201_DS", "name": "DS", "stream": "BSCIT", "year": "SY", "weekly": 5, "teacher": "AG", "color": "#FFD6A5"}, {"code": "BSCIT201_HWM", "name": "HWM", "stream": "BSCIT", "year": "SY", "weekly": 3, "teacher": "HV", "color": "#CFBAF0"}, {"code": "BSCIT201_NSS", "name": "NSS", "stream": "BSCIT", "year": "SY", "weekly": 1, "teacher": "KG", "color": "#9BF6FF"}, {"code": "BSCIT201_OS", "name": "OS", "stream": "BSCIT", "year": "SY", "weekly": 3, "teacher": "RSW", "color": "#D4A5A5"}, {"code": "BSCIT201_PYTHON", "name": "PYTHON", "stream": "BSCIT", "year": "SY", "weekly": 5, "teacher": "VN", "color": "#FDFFB6"}, {"code": "BSCIT201_WEB", "name": "WEB", "stream": "BSCIT", "year": "SY", "weekly": 5, "teacher": "AG", "color": "#D4A5A5"}, {"code": "BSCIT301_NET", "name": ".NET", "stream": "BSCIT", "year": "TY", "weekly": 5, "teacher": "TJ", "color": "#BDE0FE"}, {"code": "BSCIT301_AI", "name": "AI", "stream": "BSCIT", "year": "TY", "weekly": 5, "teacher": "KG", "color": "#BAE1FF"}, {"code": "BSCIT301_CS", "name": "CS", "stream": "BSCIT", "year": "TY", "weekly": 2, "teacher": "HV", "color": "#FFD6A5"}, {"code": "BSCIT301_CS_PRACT", "name": "CS Pract", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "MMA", "color": "#FDE2E4"}, {"code": "BSCIT301_E_JAVA", "name": "E.JAVA", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "RSW", "color": "#A0C4FF"}, {"code": "BSCIT301_IKS", "name": "IKS", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "MMA", "color": "#BDE0FE"}, {"code": "BSCIT301_IOT", "name": "IOT", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "VN", "color": "#90DBF4"}, {"code": "BSCIT301_MERN_STACK", "name": "MERN STACK", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "AG", "color": "#CFBAF0"}, {"code": "BSCCS101_DSA", "name": "DSA", "stream": "BSCCS", "year": "FY", "weekly": 5, "teacher": "TJ", "color": "#8EECF5"}, {"code": "BSCCS101_EM", "name": "EM", "stream": "BSCCS", "year": "FY", "weekly": 1, "teacher": "AG", "color": "#BAFFC9"}, {"code": "BSCCS101_EMSD", "name": "EMSD", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "NS", "color": "#BAE1FF"}, {"code": "BSCCS101_FDS", "name": "FDS", "stream": "BSCCS", "year": "FY", "weekly": 5, "teacher": "SNK", "color": "#CAFFBF"}, {"code": "BSCCS101_ICS", "name": "ICS", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "TD", "color": "#A0C4FF"}, {"code": "BSCCS101_IKS", "name": "IKS", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "KD", "color": "#CDE7BE"}, {"code": "BSCCS101_INTRO_TO_COMM", "name": "Intro to Comm", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "AI", "color": "#FFC6FF"}, {"code": "BSCCS101_NSS", "name": "NSS", "stream": "BSCCS", "year": "FY", "weekly": 1, "teacher": "KG", "color": "#CFBAF0"}, {"code": "BSCCS101_PYTHON", "name": "PYTHON", "stream": "BSCCS", "year": "FY", "weekly": 3, "teacher": "VN", "color": "#FDE2E4"}, {"code": "BSCCS101_STAT_W_R", "name": "STAT WITH R", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "KG", "color": "#FFADAD"}, {"code": "BSCCS201_BIG_DATA", "name": "BIG DATA", "stream": "BSCCS", "year": "SY", "weekly": 2, "teacher": "KG", "color": "#C7CEEA"}, {"code": "BSCCS201_DS", "name": "DS", "stream": "BSCCS", "year": "SY", "weekly": 4, "teacher": "HV", "color": "#FDE2E4"}, {"code": "BSCCS201_HWM", "name": "HWM", "stream": "BSCCS", "year": "SY", "weekly": 3, "teacher": "HV", "color": "#BAE1FF"}, {"code": "BSCCS201_ITDA", "name": "ITDA", "stream": "BSCCS", "year": "SY", "weekly": 3, "teacher": "MMA", "color": "#CDE7BE"}, {"code": "BSCCS201_JAVA", "name": "JAVA", "stream": "BSCCS", "year": "SY", "weekly": 4, "teacher": "RSW", "color": "#CDE7BE"}, {"code": "BSCCS201_NSS", "name": "NSS", "stream": "BSCCS", "year": "SY", "weekly": 1, "teacher": "KG", "color": "#90DBF4"}, {"code": "BSCCS201_OS", "name": "OS", "stream": "BSCCS", "year": "SY", "weekly": 5, "teacher": "AG", "color": "#A0C4FF"}, {"code": "BSCCS201_R_DS", "name": "R DS", "stream": "BSCCS", "year": "SY", "weekly": 1, "teacher": "HV", "color": "#FFC6FF"}, {"code": "BSCCS201_TOC", "name": "TOC", "stream": "BSCCS", "year": "SY", "weekly": 3, "teacher": "TJ", "color": "#CDE7BE"}, {"code": "BSCCS301_AI", "name": "AI", "stream": "BSCCS", "year": "TY", "weekly": 5, "teacher": "KG", "color": "#D4A5A5"}, {"code": "BSCCS301_CIS", "name": "CIS", "stream": "BSCCS", "year": "TY", "weekly": 6, "teacher": "RSW", "color": "#FFADAD"}, {"code": "BSCCS301_EH", "name": "EH", "stream": "BSCCS", "year": "TY", "weekly": 3, "teacher": "HV", "color": "#FFB3BA"}, {"code": "BSCCS301_IKS", "name": "IKS", "stream": "BSCCS", "year": "TY", "weekly": 3, "teacher": "TJ", "color": "#FFB3BA"}, {"code": "BSCCS301_LINUX", "name": "LINUX", "stream": "BSCCS", "year": "TY", "weekly": 4, "teacher": "AG", "color": "#9BF6FF"}, {"code": "BSCCS301_WSN", "name": "WSN", "stream": "BSCCS", "year": "TY", "weekly": 5, "teacher": "VN", "color": "#FDFFB6"}, {"code": "BSC101_AM", "name": "AM", "stream": "BSC", "year": "FY", "weekly": 1, "teacher": "HP", "color": "#F7D6E0"}, {"code": "BSC101_AM_PRACT", "name": "AM PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "HP", "color": "#FFADAD"}, {"code": "BSC101_BPIO", "name": "BPIO", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "KD", "color": "#D7BAFF"}, {"code": "BSC101_BPIO_PRACT", "name": "BPIO PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "KD", "color": "#CDE7BE"}, {"code": "BSC101_CGI", "name": "CGI", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "NS", "color": "#CDEAC0"}, {"code": "BSC101_EMSD", "name": "EMSD", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "AP", "color": "#BAE1FF"}, {"code": "BSC101_ICS", "name": "ICS", "stream": "BSC", "year": "FY", "weekly": 1, "teacher": "TD", "color": "#A0C4FF"}, {"code": "BSC101_IKS", "name": "IKS", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "MA", "color": "#CDE7BE"}, {"code": "BSC101_LP", "name": "LP", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "SN", "color": "#8EECF5"}, {"code": "BSC101_LP_PRACT", "name": "LP PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "SN", "color": "#FFC6FF"}, {"code": "BSC101_PSHW", "name": "PSHW", "stream": "BSC", "year": "FY", "weekly": 3, "teacher": "MA", "color": "#F7D6E0"}, {"code": "BSC101_PSHW_PRACT", "name": "PSHW PRACT", "stream": "BSC", "year": "FY", "weekly": 2, "teacher": "MA", "color": "#FFADAD"}, {"code": "BSC201_CYTOLOGY", "name": "Cytology", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "SN", "color": "#90DBF4"}, {"code": "BSC201_CYTOLOGY_PRACT", "name": "Cytology Pract", "stream": "BSC", "year": "SY", "weekly": 1, "teacher": "SN", "color": "#D7BAFF"}, {"code": "BSC201_DLLE", "name": "DLLE", "stream": "BSC", "year": "SY", "weekly": 1, "teacher": "HV", "color": "#D4A5A5"}, {"code": "BSC201_FFB", "name": "FFB", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "AI", "color": "#BAE1FF"}, {"code": "BSC201_PIOC", "name": "PIOC", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "AP", "color": "#BDE0FE"}, {"code": "BSC201_PIOC_PRACT", "name": "PIOC PRACT", "stream": "BSC", "year": "SY", "weekly": 2, "teacher": "AP", "color": "#FFB3BA"}, {"code": "BSC201_PPAC", "name": "PPAC", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "KD", "color": "#FFB3BA"}, {"code": "BSC201_PPAC_PRACT", "name": "PPAC PRACT", "stream": "BSC", "year": "SY", "weekly": 2, "teacher": "KD", "color": "#E2F0CB"}, {"code": "BSC201_SIC", "name": "SIC", "stream": "BSC", "year": "SY", "weekly": 3, "teacher": "NS", "color": "#BDB2FF"}, {"code": "BSC301_AAIC_HANDI_ZOO", "name": "AAIC", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "KD", "color": "#E2F0CB"}, {"code": "BSC301_AAIC_HANDI_CHEM", "name": "H&I", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "HP", "color": "#FFB3BA"}, {"code": "BSC301_AAIC_NCT_ZOO", "name": "AAIC", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "KD", "color": "#FFD6A5"}, {"code": "BSC301_AAIC_NCT_CHEM", "name": "NCT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "SN", "color": "#E2F0CB"}, {"code": "BSC301_AC_CC_ZOO", "name": "AC", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "HP", "color": "#E2F0CB"}, {"code": "BSC301_AC_CC_CHEM", "name": "CC", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "AP", "color": "#FFB3BA"}, {"code": "BSC301_AC_CC_PRACT_ZOO", "name": "AC", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "HP", "color": "#FFD6A5"}, {"code": "BSC301_AC_CC_PRACT_CHEM", "name": "CC PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "AP", "color": "#E2F0CB"}, {"code": "BSC301_AIOC_HANDI_ZOO", "name": "AIOC", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "AP", "color": "#BDE0FE"}, {"code": "BSC301_AIOC_HANDI_CHEM", "name": "H&I", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "HP", "color": "#98F5E1"}, {"code": "BSC301_AIOC_NCT_ZOO", "name": "AIOC", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "AP", "color": "#FFB3BA"}, {"code": "BSC301_AIOC_NCT_CHEM", "name": "NCT", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "SN", "color": "#BDE0FE"}, {"code": "BSC301_APAC_SERICULTURE_ZOO", "name": "APAC", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "KD", "color": "#9BF6FF"}, {"code": "BSC301_APAC_SERICULTURE_CHEM", "name": "SERICULTURE", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "SN", "color": "#F8C8DC"}, {"code": "BSC301_DANDD_PRACT_MD_PRACT_ZOO", "name": "D&D PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "NS", "color": "#C7CEEA"}, {"code": "BSC301_DANDD_PRACT_MD_PRACT_CHEM", "name": "MD PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "HP", "color": "#FFFFBA"}, {"code": "BSC301_DANDD_MD_ZOO", "name": "D&D", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "NS", "color": "#FDE2E4"}, {"code": "BSC301_DANDD_MD_CHEM", "name": "MD", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "HP", "color": "#FFD6A5"}, {"code": "BSC301_DLLE", "name": "DLLE", "stream": "BSC", "year": "TY", "weekly": 1, "teacher": "HV", "color": "#CDE7BE"}, {"code": "BSC301_IKS_ZIKS_ZOO", "name": "IKS", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "NS", "color": "#FDE2E4"}, {"code": "BSC301_IKS_ZIKS_CHEM", "name": "ZIKS", "stream": "BSC", "year": "TY", "weekly": 3, "teacher": "HP", "color": "#FFD6A5"}, {"code": "BSC301_MJP_PRACT_NCT_PRACT_ZOO", "name": "MJP PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "KD", "color": "#E2F0CB"}, {"code": "BSC301_MJP_PRACT_NCT_PRACT_CHEM", "name": "NCT PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "SN", "color": "#FFB3BA"}, {"code": "BSC301_TCAS_PRACT", "name": "TCAS PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "AP", "color": "#FFDFBA"}, {"code": "BMS101_BCS", "name": "BCS", "stream": "BCOMMS", "year": "FY", "weekly": 2, "teacher": "AG", "color": "#E2F0CB"}, {"code": "BMS101_BMS", "name": "BMS", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "SK", "color": "#BAFFC9"}, {"code": "BMS101_BSS", "name": "BSS", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "SP", "color": "#FDE2E4"}, {"code": "BMS101_DLLE", "name": "DLLE", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "MVP", "color": "#FFC6FF"}, {"code": "BMS101_EMSD", "name": "EMSD", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "MA", "color": "#98F5E1"}, {"code": "BMS101_IKS", "name": "IKS", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "VS", "color": "#CDEAC0"}, {"code": "BMS101_ITBM", "name": "ITBM", "stream": "BCOMMS", "year": "FY", "weekly": 3, "teacher": "HV", "color": "#FDFFB6"}, {"code": "BMS101_OST", "name": "OST", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "HV", "color": "#E2F0CB"}, {"code": "BMS101_PM", "name": "PM", "stream": "BCOMMS", "year": "FY", "weekly": 4, "teacher": "AI", "color": "#B5EAD7"}, {"code": "BMS101_PRACT", "name": "PRACT", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "VN", "color": "#D7BAFF"}, {"code": "BMS101_WD", "name": "WD", "stream": "BCOMMS", "year": "FY", "weekly": 1, "teacher": "VN", "color": "#FFADAD"}, {"code": "BMS201_BL", "name": "BL", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "PJ", "color": "#F1C0E8"}, {"code": "BMS201_DLLE", "name": "DLLE", "stream": "BCOMMS", "year": "SY", "weekly": 1, "teacher": "MVP", "color": "#BDE0FE"}, {"code": "BMS201_FM_TD_HR", "name": "FM", "stream": "BCOMMS", "year": "SY", "weekly": 4, "teacher": "SP", "color": "#FFDFBA"}, {"code": "BMS201_FM_TD_FIN", "name": "TD", "stream": "BCOMMS", "year": "SY", "weekly": 4, "teacher": "VS", "color": "#CDEAC0"}, {"code": "BMS201_FSA_RS_HR", "name": "FSA", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "JVP", "color": "#C7CEEA"}, {"code": "BMS201_FSA_RS_FIN", "name": "RS", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "SK", "color": "#FFFFBA"}, {"code": "BMS201_IFS_HRM_HR", "name": "IFS", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "TD", "color": "#FDE2E4"}, {"code": "BMS201_IFS_HRM_FIN", "name": "HRM", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "AI", "color": "#FFD6A5"}, {"code": "BMS201_UI_UX", "name": "UI/UX", "stream": "BCOMMS", "year": "SY", "weekly": 3, "teacher": "MMA", "color": "#B5EAD7"}, {"code": "BMS301_BL", "name": "BL", "stream": "BCOMMS", "year": "TY", "weekly": 4, "teacher": "PJ", "color": "#CFBAF0"}, {"code": "BMS301_CA_GP_IN_HRM_HR", "name": "CA", "stream": "BCOMMS", "year": "TY", "weekly": 3, "teacher": "JVP", "color": "#CAFFBF"}, {"code": "BMS301_CA_GP_IN_HRM_FIN", "name": "GP IN HRM", "stream": "BCOMMS", "year": "TY", "weekly": 3, "teacher": "AI", "color": "#C7CEEA"}, {"code": "BMS301_CA_HRAA_HR", "name": "CA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP", "color": "#F7D6E0"}, {"code": "BMS301_CA_HRAA_FIN", "name": "HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "AI", "color": "#FFC6FF"}, {"code": "BMS301_DT_GMC_IN_HR_HR", "name": "DT", "stream": "BCOMMS", "year": "TY", "weekly": 2, "teacher": "JVP", "color": "#C7CEEA"}, {"code": "BMS301_DT_GMC_IN_HR_FIN", "name": "GMC in HR", "stream": "BCOMMS", "year": "TY", "weekly": 2, "teacher": "VS", "color": "#FFFFBA"}, {"code": "BMS301_DT_HRAA_HR", "name": "DT", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP", "color": "#9BF6FF"}, {"code": "BMS301_DT_HRAA_FIN", "name": "HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "AI", "color": "#F8C8DC"}, {"code": "BMS301_DT_P_AND_P_HR", "name": "DT", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP", "color": "#F8C8DC"}, {"code": "BMS301_DT_P_AND_P_FIN", "name": "P & P", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MVP", "color": "#BAFFC9"}, {"code": "BMS301_EFM_HRAA", "name": "EFM / HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "SP", "color": "#98F5E1"}, {"code": "BMS301_EFM_P_AND_P_HR", "name": "EFM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "SP", "color": "#FFB3BA"}, {"code": "BMS301_EFM_P_AND_P_FIN", "name": "P & P", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MVP", "color": "#BDE0FE"}, {"code": "BMS301_EFM_SHRM_HR", "name": "EFM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "SP", "color": "#E2F0CB"}, {"code": "BMS301_EFM_SHRM_FIN", "name": "SHRM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MVP", "color": "#FFB3BA"}, {"code": "BMS301_IAPM_P_AND_P_HR", "name": "IAPM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "JVP", "color": "#9BF6FF"}, {"code": "BMS301_IAPM_P_AND_P_FIN", "name": "P & P", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "SK", "color": "#F8C8DC"}, {"code": "BMS301_IAPM_SHRM_HR", "name": "IAPM", "stream": "BCOMMS", "year": "TY", "weekly": 3, "teacher": "JVP", "color": "#90DBF4"}, {"code": "BMS301_IAPM_SHRM_FIN", "name": "SHRM", "stream": "BCOMMS", "year": "TY", "weekly": 3, "teacher": "SK", "color": "#9BF6FF"}, {"code": "BMS301_WM_GMC_IN_HR_HR", "name": "WM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MP", "color": "#BDE0FE"}, {"code": "BMS301_WM_GMC_IN_HR_FIN", "name": "GMC in HR", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "VS", "color": "#98F5E1"}, {"code": "BMS301_WM_GP_IN_HRM_HR", "name": "WM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MP", "color": "#A0C4FF"}, {"code": "BMS301_WM_GP_IN_HRM_FIN", "name": "GP IN HRM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "VS", "color": "#D4A5A5"}, {"code": "BMS301_WM_HRAA_HR", "name": "WM", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "MP", "color": "#FFDFBA"}, {"code": "BMS301_WM_HRAA_FIN", "name": "HRAA", "stream": "BCOMMS", "year": "TY", "weekly": 1, "teacher": "AI", "color": "#CDEAC0"}, {"code": "BCOM101_AFM", "name": "AFM", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "SK", "color": "#FFADAD"}, {"code": "BCOM101_BCS", "name": "BCS", "stream": "BCOM", "year": "FY", "weekly": 2, "teacher": "TD", "color": "#F8C8DC"}, {"code": "BCOM101_COMM_I", "name": "COMM - I", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "MVP", "color": "#CDEAC0"}, {"code": "BCOM101_DLLE", "name": "DLLE", "stream": "BCOM", "year": "FY", "weekly": 1, "teacher": "SK", "color": "#FDE2E4"}, {"code": "BCOM101_EMSD", "name": "EMSD", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "MA", "color": "#FDFFB6"}, {"code": "BCOM101_FM", "name": "FM", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "TD", "color": "#FDFFB6"}, {"code": "BCOM101_FSU", "name": "FSU", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "AI", "color": "#CAFFBF"}, {"code": "BCOM101_IKS", "name": "IKS", "stream": "BCOM", "year": "FY", "weekly": 2, "teacher": "MA", "color": "#CFBAF0"}, {"code": "BCOM101_NS", "name": "NS", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "TD", "color": "#FFDFBA"}, {"code": "BCOM101_OST", "name": "OST", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "HV", "color": "#F8C8DC"}, {"code": "BCOM101_WD", "name": "WD", "stream": "BCOM", "year": "FY", "weekly": 3, "teacher": "VN", "color": "#C7CEEA"}, {"code": "BCOM201_A_AND_A", "name": "A & A", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "SP", "color": "#90DBF4"}, {"code": "BCOM201_ADVT", "name": "ADVT", "stream": "BCOM", "year": "SY", "weekly": 1, "teacher": "SP", "color": "#B5EAD7"}, {"code": "BCOM201_AFM", "name": "AFM", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "JVP", "color": "#E2F0CB"}, {"code": "BCOM201_BL", "name": "BL", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "PJ", "color": "#8EECF5"}, {"code": "BCOM201_COMM_III", "name": "COMM - III", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "MVP", "color": "#D7BAFF"}, {"code": "BCOM201_FBM", "name": "FBM", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "SK", "color": "#B5EAD7"}, {"code": "BCOM201_UI_UX", "name": "UI/UX", "stream": "BCOM", "year": "SY", "weekly": 3, "teacher": "MMA", "color": "#D4A5A5"}, {"code": "BCOM301_ACCOUNT", "name": "Account", "stream": "BCOM", "year": "TY", "weekly": 6, "teacher": "SP", "color": "#BDE0FE"}, {"code": "BCOM301_BL", "name": "BL", "stream": "BCOM", "year": "TY", "weekly": 4, "teacher": "PJ", "color": "#98F5E1"}, {"code": "BCOM301_COMM_V", "name": "COMM - V", "stream": "BCOM", "year": "TY", "weekly": 4, "teacher": "MVP", "color": "#E2F0CB"}, {"code": "BCOM301_IAPM", "name": "IAPM", "stream": "BCOM", "year": "TY", "weekly": 3, "teacher": "JVP", "color": "#FDFFB6"}, {"code": "BCOM301_IKS", "name": "IKS", "stream": "BCOM", "year": "TY", "weekly": 2, "teacher": "MVP", "color": "#8EECF5"}, {"code": "BCOM301_PANDSK", "name": "P&SK", "stream": "BCOM", "year": "TY", "weekly": 4, "teacher": "SK", "color": "#BDB2FF"}, {"code": "BSCIT101_CSD_LAB_1", "name": "CSD LAB 1", "stream": "BSCIT", "year": "FY", "weekly": 2, "teacher": "MMA", "color": "#CAFFBF"}, {"code": "BSCIT101_PROG_W_C_LAB_1", "name": "PROG WITH C LAB 1", "stream": "BSCIT", "year": "FY", "weekly": 2, "teacher": "VN", "color": "#FFC6FF"}, {"code": "BSCIT101_DBMS_LAB_1", "name": "DBMS LAB 1", "stream": "BSCIT", "year": "FY", "weekly": 2, "teacher": "MMA", "color": "#BAE1FF"}, {"code": "BSCIT101_OTDM_LAB_1", "name": "OTDM LAB 1", "stream": "BSCIT", "year": "FY", "weekly": 2, "teacher": "TJ", "color": "#CAFFBF"}, {"code": "BSCIT201_WEB_LAB_2", "name": "WEB LAB 2", "stream": "BSCIT", "year": "SY", "weekly": 2, "teacher": "AG", "color": "#B5EAD7"}, {"code": "BSCIT201_PYTHON_LAB_2", "name": "PYTHON LAB 2", "stream": "BSCIT", "year": "SY", "weekly": 2, "teacher": "VN", "color": "#98F5E1"}, {"code": "BSCIT201_DS_LAB_2", "name": "DS LAB 2", "stream": "BSCIT", "year": "SY", "weekly": 2, "teacher": "AG", "color": "#8EECF5"}, {"code": "BSCIT301_NET_LAB_2", "name": ". NET LAB 2", "stream": "BSCIT", "year": "TY", "weekly": 2, "teacher": "TJ", "color": "#BAE1FF"}, {"code": "BSCIT301_E_JAVA_LAB_2", "name": "E. JAVA LAB 2", "stream": "BSCIT", "year": "TY", "weekly": 2, "teacher": "RSW", "color": "#FDFFB6"}, {"code": "BSCIT301_AI_LAB_1", "name": "AI LAB 1", "stream": "BSCIT", "year": "TY", "weekly": 1, "teacher": "KG", "color": "#FFB3BA"}, {"code": "BSCIT301_MERN_STACK_LAB_2", "name": "MERN STACK LAB 2", "stream": "BSCIT", "year": "TY", "weekly": 2, "teacher": "AG", "color": "#CDEAC0"}, {"code": "BSCIT301_CS_LAB_1", "name": "CS LAB 1", "stream": "BSCIT", "year": "TY", "weekly": 3, "teacher": "MMA", "color": "#90DBF4"}, {"code": "BSCIT301_IOT_LAB_1", "name": "IOT LAB 1", "stream": "BSCIT", "year": "TY", "weekly": 2, "teacher": "VN", "color": "#CDEAC0"}, {"code": "BSCIT301_AI_LAB_2", "name": "AI LAB 2", "stream": "BSCIT", "year": "TY", "weekly": 1, "teacher": "KG", "color": "#FFDFBA"}, {"code": "BSCCS101_FDS_LAB_1", "name": "FDS LAB 1", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "MMA", "color": "#98F5E1"}, {"code": "BSCCS101_PYTHON_LAB_1", "name": "PYTHON LAB 1", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "VN", "color": "#D7BAFF"}, {"code": "BSCCS101_DSA_LAB_1", "name": "DSA LAB 1", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "TJ", "color": "#FDE2E4"}, {"code": "BSCCS101_STAT_W_R_LAB_1", "name": "STAT WITH R LAB 1", "stream": "BSCCS", "year": "FY", "weekly": 2, "teacher": "KG", "color": "#CAFFBF"}, {"code": "BSCCS201_DS_LAB_2", "name": "DS LAB 2", "stream": "BSCCS", "year": "SY", "weekly": 2, "teacher": "HV", "color": "#FFC6FF"}, {"code": "BSCCS201_JAVA_LAB_2", "name": "JAVA LAB 2", "stream": "BSCCS", "year": "SY", "weekly": 2, "teacher": "RSW", "color": "#C7CEEA"}, {"code": "BSCCS201_OS_LAB_2", "name": "OS LAB 2", "stream": "BSCCS", "year": "SY", "weekly": 2, "teacher": "AG", "color": "#FDFFB6"}, {"code": "BSCCS301_WSN_LAB_2", "name": "WSN LAB 2", "stream": "BSCCS", "year": "TY", "weekly": 2, "teacher": "VN", "color": "#98F5E1"}, {"code": "BSCCS301_AI_LAB_2", "name": "AI LAB 2", "stream": "BSCCS", "year": "TY", "weekly": 2, "teacher": "KG", "color": "#B5EAD7"}, {"code": "BSCCS301_EH_LAB_2", "name": "EH LAB 2", "stream": "BSCCS", "year": "TY", "weekly": 2, "teacher": "HV", "color": "#D4A5A5"}, {"code": "BSCCS301_CIS_LAB_2", "name": "CIS LAB 2", "stream": "BSCCS", "year": "TY", "weekly": 2, "teacher": "RSW", "color": "#9BF6FF"}, {"code": "BSCCS301_LINUX_LAB_2", "name": "LINUX LAB 2", "stream": "BSCCS", "year": "TY", "weekly": 2, "teacher": "AG", "color": "#FFD6A5"}, {"code": "BSC301_MJ_PRACT_H_AND_I_PRACT_ZOO", "name": "MJ PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "KD", "color": "#A0C4FF"}, {"code": "BSC301_MJ_PRACT_H_AND_I_PRACT_CHEM", "name": "H & I PRACT", "stream": "BSC", "year": "TY", "weekly": 2, "teacher": "HP", "color": "#D4A5A5"}, {"code": "BMS101_WD_LAB_1", "name": "WD LAB 1", "stream": "BCOMMS", "year": "FY", "weekly": 2, "teacher": "VN", "color": "#CAFFBF"}, {"code": "BMS101_OST_LAB_1", "name": "OST LAB 1", "stream": "BCOMMS", "year": "FY", "weekly": 2, "teacher": "HV", "color": "#9BF6FF"}, {"code": "BMS201_UI_UX_LAB_1", "name": "UI/UX LAB 1", "stream": "BCOMMS", "year": "SY", "weekly": 2, "teacher": "MMA", "color": "#A0C4FF"}, {"code": "BCOM101_WD_LAB_1", "name": "WD LAB 1", "stream": "BCOM", "year": "FY", "weekly": 2, "teacher": "VN", "color": "#BDB2FF"}, {"code": "BCOM101_OST_LAB_1", "name": "OST LAB 1", "stream": "BCOM", "year": "FY", "weekly": 2, "teacher": "HV", "color": "#FFADAD"}, {"code": "BCOM201_UI_UX_LAB_1", "name": "UI/UX LAB 1", "stream": "BCOM", "year": "SY", "weekly": 2, "teacher": "MMA", "color": "#E2F0CB"}];

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
        color: def.color ?? SUBJECT_COLORS[Math.abs(def.code.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % SUBJECT_COLORS.length],
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
        color: def.color ?? SUBJECT_COLORS[Math.abs(def.code.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % SUBJECT_COLORS.length],
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
  }> = [{"subjectCode": "BSCIT101_CSD", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BSCIT101_DBMS", "classKeys": ["BSCIT-FY-A"], "weekly": 5, "teacher": "SNK"}, {"subjectCode": "BSCIT101_EM", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "VS"}, {"subjectCode": "BSCIT101_EMSD", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "AP"}, {"subjectCode": "BSCIT101_ICS", "classKeys": ["BSCIT-FY-A"], "weekly": 1, "teacher": "TD"}, {"subjectCode": "BSCIT101_IKS", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSCIT101_INTRO_TO_COMM", "classKeys": ["BSCIT-FY-A"], "weekly": 3, "teacher": "VS"}, {"subjectCode": "BSCIT101_NSS", "classKeys": ["BSCIT-FY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BSCIT101_OTDM", "classKeys": ["BSCIT-FY-A"], "weekly": 2, "teacher": "TJ"}, {"subjectCode": "BSCIT101_PROG_W_C", "classKeys": ["BSCIT-FY-A"], "weekly": 5, "teacher": "VN"}, {"subjectCode": "BSCIT201_AM", "classKeys": ["BSCIT-SY-A"], "weekly": 3, "teacher": "KG"}, {"subjectCode": "BSCIT201_DS", "classKeys": ["BSCIT-SY-A"], "weekly": 5, "teacher": "AG"}, {"subjectCode": "BSCIT201_HWM", "classKeys": ["BSCIT-SY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BSCIT201_NSS", "classKeys": ["BSCIT-SY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BSCIT201_OS", "classKeys": ["BSCIT-SY-A"], "weekly": 3, "teacher": "RSW"}, {"subjectCode": "BSCIT201_PYTHON", "classKeys": ["BSCIT-SY-A"], "weekly": 5, "teacher": "VN"}, {"subjectCode": "BSCIT201_WEB", "classKeys": ["BSCIT-SY-A"], "weekly": 5, "teacher": "AG"}, {"subjectCode": "BSCIT301_NET", "classKeys": ["BSCIT-TY-A"], "weekly": 5, "teacher": "TJ"}, {"subjectCode": "BSCIT301_AI", "classKeys": ["BSCIT-TY-A"], "weekly": 5, "teacher": "KG"}, {"subjectCode": "BSCIT301_CS", "classKeys": ["BSCIT-TY-A"], "weekly": 2, "teacher": "HV"}, {"subjectCode": "BSCIT301_CS_PRACT", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BSCIT301_E_JAVA", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "RSW"}, {"subjectCode": "BSCIT301_IKS", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BSCIT301_IOT", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "VN"}, {"subjectCode": "BSCIT301_MERN_STACK", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "AG"}, {"subjectCode": "BSCCS101_DSA", "classKeys": ["BSCCS-FY-A"], "weekly": 5, "teacher": "TJ"}, {"subjectCode": "BSCCS101_EM", "classKeys": ["BSCCS-FY-A"], "weekly": 1, "teacher": "AG"}, {"subjectCode": "BSCCS101_EMSD", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSCCS101_FDS", "classKeys": ["BSCCS-FY-A"], "weekly": 5, "teacher": "SNK"}, {"subjectCode": "BSCCS101_ICS", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "TD"}, {"subjectCode": "BSCCS101_IKS", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BSCCS101_INTRO_TO_COMM", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BSCCS101_NSS", "classKeys": ["BSCCS-FY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BSCCS101_PYTHON", "classKeys": ["BSCCS-FY-A"], "weekly": 3, "teacher": "VN"}, {"subjectCode": "BSCCS101_STAT_W_R", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "KG"}, {"subjectCode": "BSCCS201_BIG_DATA", "classKeys": ["BSCCS-SY-A"], "weekly": 2, "teacher": "KG"}, {"subjectCode": "BSCCS201_DS", "classKeys": ["BSCCS-SY-A"], "weekly": 4, "teacher": "HV"}, {"subjectCode": "BSCCS201_HWM", "classKeys": ["BSCCS-SY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BSCCS201_ITDA", "classKeys": ["BSCCS-SY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BSCCS201_JAVA", "classKeys": ["BSCCS-SY-A"], "weekly": 4, "teacher": "RSW"}, {"subjectCode": "BSCCS201_NSS", "classKeys": ["BSCCS-SY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BSCCS201_OS", "classKeys": ["BSCCS-SY-A"], "weekly": 5, "teacher": "AG"}, {"subjectCode": "BSCCS201_R_DS", "classKeys": ["BSCCS-SY-A"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BSCCS201_TOC", "classKeys": ["BSCCS-SY-A"], "weekly": 3, "teacher": "TJ"}, {"subjectCode": "BSCCS301_AI", "classKeys": ["BSCCS-TY-A"], "weekly": 5, "teacher": "KG"}, {"subjectCode": "BSCCS301_CIS", "classKeys": ["BSCCS-TY-A"], "weekly": 6, "teacher": "RSW"}, {"subjectCode": "BSCCS301_EH", "classKeys": ["BSCCS-TY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BSCCS301_IKS", "classKeys": ["BSCCS-TY-A"], "weekly": 3, "teacher": "TJ"}, {"subjectCode": "BSCCS301_LINUX", "classKeys": ["BSCCS-TY-A"], "weekly": 4, "teacher": "AG"}, {"subjectCode": "BSCCS301_WSN", "classKeys": ["BSCCS-TY-A"], "weekly": 5, "teacher": "VN"}, {"subjectCode": "BSC101_AM", "classKeys": ["BSC-FY-A"], "weekly": 1, "teacher": "HP"}, {"subjectCode": "BSC101_AM_PRACT", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "HP"}, {"subjectCode": "BSC101_BPIO", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BSC101_BPIO_PRACT", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC101_CGI", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "NS"}, {"subjectCode": "BSC101_EMSD", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "AP"}, {"subjectCode": "BSC101_ICS", "classKeys": ["BSC-FY-A"], "weekly": 1, "teacher": "TD"}, {"subjectCode": "BSC101_IKS", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BSC101_LP", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "SN"}, {"subjectCode": "BSC101_LP_PRACT", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "SN"}, {"subjectCode": "BSC101_PSHW", "classKeys": ["BSC-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BSC101_PSHW_PRACT", "classKeys": ["BSC-FY-A"], "weekly": 2, "teacher": "MA"}, {"subjectCode": "BSC201_CYTOLOGY", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "SN"}, {"subjectCode": "BSC201_CYTOLOGY_PRACT", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 1, "teacher": "SN"}, {"subjectCode": "BSC201_DLLE", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BSC201_FFB", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BSC201_PIOC", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "AP"}, {"subjectCode": "BSC201_PIOC_PRACT", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 2, "teacher": "AP"}, {"subjectCode": "BSC201_PPAC", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BSC201_PPAC_PRACT", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC201_SIC", "classKeys": ["BSC-SY-ZOO", "BSC-SY-Chemistry"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSC301_AAIC_HANDI_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 1, "teacher": "KD"}, {"subjectCode": "BSC301_AAIC_HANDI_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 1, "teacher": "HP"}, {"subjectCode": "BSC301_AAIC_NCT_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC301_AAIC_NCT_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 2, "teacher": "SN"}, {"subjectCode": "BSC301_AC_CC_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 1, "teacher": "HP"}, {"subjectCode": "BSC301_AC_CC_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 1, "teacher": "AP"}, {"subjectCode": "BSC301_AC_CC_PRACT_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 2, "teacher": "HP"}, {"subjectCode": "BSC301_AC_CC_PRACT_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 2, "teacher": "AP"}, {"subjectCode": "BSC301_AIOC_HANDI_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 2, "teacher": "AP"}, {"subjectCode": "BSC301_AIOC_HANDI_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 2, "teacher": "HP"}, {"subjectCode": "BSC301_AIOC_NCT_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 1, "teacher": "AP"}, {"subjectCode": "BSC301_AIOC_NCT_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 1, "teacher": "SN"}, {"subjectCode": "BSC301_APAC_SERICULTURE_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 3, "teacher": "KD"}, {"subjectCode": "BSC301_APAC_SERICULTURE_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 3, "teacher": "SN"}, {"subjectCode": "BSC301_DANDD_PRACT_MD_PRACT_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 2, "teacher": "NS"}, {"subjectCode": "BSC301_DANDD_PRACT_MD_PRACT_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 2, "teacher": "HP"}, {"subjectCode": "BSC301_DANDD_MD_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSC301_DANDD_MD_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 3, "teacher": "HP"}, {"subjectCode": "BSC301_DLLE", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BSC301_IKS_ZIKS_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 3, "teacher": "NS"}, {"subjectCode": "BSC301_IKS_ZIKS_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 3, "teacher": "HP"}, {"subjectCode": "BSC301_MJP_PRACT_NCT_PRACT_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC301_MJP_PRACT_NCT_PRACT_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 2, "teacher": "SN"}, {"subjectCode": "BSC301_TCAS_PRACT", "classKeys": ["BSC-TY-ZOO", "BSC-TY-Chemistry"], "weekly": 2, "teacher": "AP"}, {"subjectCode": "BMS101_BCS", "classKeys": ["BCOMMS-FY-A"], "weekly": 2, "teacher": "AG"}, {"subjectCode": "BMS101_BMS", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BMS101_BSS", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "SP"}, {"subjectCode": "BMS101_DLLE", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "MVP"}, {"subjectCode": "BMS101_EMSD", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BMS101_IKS", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "VS"}, {"subjectCode": "BMS101_ITBM", "classKeys": ["BCOMMS-FY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BMS101_OST", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "HV"}, {"subjectCode": "BMS101_PM", "classKeys": ["BCOMMS-FY-A"], "weekly": 4, "teacher": "AI"}, {"subjectCode": "BMS101_PRACT", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "VN"}, {"subjectCode": "BMS101_WD", "classKeys": ["BCOMMS-FY-A"], "weekly": 1, "teacher": "VN"}, {"subjectCode": "BMS201_BL", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 3, "teacher": "PJ"}, {"subjectCode": "BMS201_DLLE", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 1, "teacher": "MVP"}, {"subjectCode": "BMS201_FM_TD_HR", "classKeys": ["BCOMMS-SY-HR"], "weekly": 4, "teacher": "SP"}, {"subjectCode": "BMS201_FM_TD_FIN", "classKeys": ["BCOMMS-SY-Finance"], "weekly": 4, "teacher": "VS"}, {"subjectCode": "BMS201_FSA_RS_HR", "classKeys": ["BCOMMS-SY-HR"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BMS201_FSA_RS_FIN", "classKeys": ["BCOMMS-SY-Finance"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BMS201_IFS_HRM_HR", "classKeys": ["BCOMMS-SY-HR"], "weekly": 3, "teacher": "TD"}, {"subjectCode": "BMS201_IFS_HRM_FIN", "classKeys": ["BCOMMS-SY-Finance"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BMS201_UI_UX", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BMS301_BL", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 4, "teacher": "PJ"}, {"subjectCode": "BMS301_CA_GP_IN_HRM_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BMS301_CA_GP_IN_HRM_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BMS301_CA_HRAA_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS301_CA_HRAA_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "AI"}, {"subjectCode": "BMS301_DT_GMC_IN_HR_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 2, "teacher": "JVP"}, {"subjectCode": "BMS301_DT_GMC_IN_HR_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 2, "teacher": "VS"}, {"subjectCode": "BMS301_DT_HRAA_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS301_DT_HRAA_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "AI"}, {"subjectCode": "BMS301_DT_P_AND_P_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS301_DT_P_AND_P_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "MVP"}, {"subjectCode": "BMS301_EFM_HRAA", "classKeys": ["BCOMMS-TY-HR", "BCOMMS-TY-Finance"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BMS301_EFM_P_AND_P_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BMS301_EFM_P_AND_P_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "MVP"}, {"subjectCode": "BMS301_EFM_SHRM_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BMS301_EFM_SHRM_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "MVP"}, {"subjectCode": "BMS301_IAPM_P_AND_P_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "JVP"}, {"subjectCode": "BMS301_IAPM_P_AND_P_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "SK"}, {"subjectCode": "BMS301_IAPM_SHRM_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BMS301_IAPM_SHRM_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BMS301_WM_GMC_IN_HR_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "MP"}, {"subjectCode": "BMS301_WM_GMC_IN_HR_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "VS"}, {"subjectCode": "BMS301_WM_GP_IN_HRM_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "MP"}, {"subjectCode": "BMS301_WM_GP_IN_HRM_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "VS"}, {"subjectCode": "BMS301_WM_HRAA_HR", "classKeys": ["BCOMMS-TY-HR"], "weekly": 1, "teacher": "MP"}, {"subjectCode": "BMS301_WM_HRAA_FIN", "classKeys": ["BCOMMS-TY-Finance"], "weekly": 1, "teacher": "AI"}, {"subjectCode": "BCOM101_AFM", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BCOM101_BCS", "classKeys": ["BCOM-FY-A"], "weekly": 2, "teacher": "TD"}, {"subjectCode": "BCOM101_COMM_I", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "MVP"}, {"subjectCode": "BCOM101_DLLE", "classKeys": ["BCOM-FY-A"], "weekly": 1, "teacher": "SK"}, {"subjectCode": "BCOM101_EMSD", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "MA"}, {"subjectCode": "BCOM101_FM", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "TD"}, {"subjectCode": "BCOM101_FSU", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "AI"}, {"subjectCode": "BCOM101_IKS", "classKeys": ["BCOM-FY-A"], "weekly": 2, "teacher": "MA"}, {"subjectCode": "BCOM101_NS", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "TD"}, {"subjectCode": "BCOM101_OST", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "HV"}, {"subjectCode": "BCOM101_WD", "classKeys": ["BCOM-FY-A"], "weekly": 3, "teacher": "VN"}, {"subjectCode": "BCOM201_A_AND_A", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "SP"}, {"subjectCode": "BCOM201_ADVT", "classKeys": ["BCOM-SY-A"], "weekly": 1, "teacher": "SP"}, {"subjectCode": "BCOM201_AFM", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BCOM201_BL", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "PJ"}, {"subjectCode": "BCOM201_COMM_III", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "MVP"}, {"subjectCode": "BCOM201_FBM", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "SK"}, {"subjectCode": "BCOM201_UI_UX", "classKeys": ["BCOM-SY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BCOM301_ACCOUNT", "classKeys": ["BCOM-TY-A"], "weekly": 6, "teacher": "SP"}, {"subjectCode": "BCOM301_BL", "classKeys": ["BCOM-TY-A"], "weekly": 4, "teacher": "PJ"}, {"subjectCode": "BCOM301_COMM_V", "classKeys": ["BCOM-TY-A"], "weekly": 4, "teacher": "MVP"}, {"subjectCode": "BCOM301_IAPM", "classKeys": ["BCOM-TY-A"], "weekly": 3, "teacher": "JVP"}, {"subjectCode": "BCOM301_IKS", "classKeys": ["BCOM-TY-A"], "weekly": 2, "teacher": "MVP"}, {"subjectCode": "BCOM301_PANDSK", "classKeys": ["BCOM-TY-A"], "weekly": 4, "teacher": "SK"}, {"subjectCode": "BSCIT101_CSD_LAB_1", "classKeys": ["BSCIT-FY-A"], "weekly": 2, "teacher": "MMA"}, {"subjectCode": "BSCIT101_PROG_W_C_LAB_1", "classKeys": ["BSCIT-FY-A"], "weekly": 2, "teacher": "VN"}, {"subjectCode": "BSCIT101_DBMS_LAB_1", "classKeys": ["BSCIT-FY-A"], "weekly": 2, "teacher": "MMA"}, {"subjectCode": "BSCIT101_OTDM_LAB_1", "classKeys": ["BSCIT-FY-A"], "weekly": 2, "teacher": "TJ"}, {"subjectCode": "BSCIT201_WEB_LAB_2", "classKeys": ["BSCIT-SY-A"], "weekly": 2, "teacher": "AG"}, {"subjectCode": "BSCIT201_PYTHON_LAB_2", "classKeys": ["BSCIT-SY-A"], "weekly": 2, "teacher": "VN"}, {"subjectCode": "BSCIT201_DS_LAB_2", "classKeys": ["BSCIT-SY-A"], "weekly": 2, "teacher": "AG"}, {"subjectCode": "BSCIT301_NET_LAB_2", "classKeys": ["BSCIT-TY-A"], "weekly": 2, "teacher": "TJ"}, {"subjectCode": "BSCIT301_E_JAVA_LAB_2", "classKeys": ["BSCIT-TY-A"], "weekly": 2, "teacher": "RSW"}, {"subjectCode": "BSCIT301_AI_LAB_1", "classKeys": ["BSCIT-TY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BSCIT301_MERN_STACK_LAB_2", "classKeys": ["BSCIT-TY-A"], "weekly": 2, "teacher": "AG"}, {"subjectCode": "BSCIT301_CS_LAB_1", "classKeys": ["BSCIT-TY-A"], "weekly": 3, "teacher": "MMA"}, {"subjectCode": "BSCIT301_IOT_LAB_1", "classKeys": ["BSCIT-TY-A"], "weekly": 2, "teacher": "VN"}, {"subjectCode": "BSCIT301_AI_LAB_2", "classKeys": ["BSCIT-TY-A"], "weekly": 1, "teacher": "KG"}, {"subjectCode": "BSCCS101_FDS_LAB_1", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "MMA"}, {"subjectCode": "BSCCS101_PYTHON_LAB_1", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "VN"}, {"subjectCode": "BSCCS101_DSA_LAB_1", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "TJ"}, {"subjectCode": "BSCCS101_STAT_W_R_LAB_1", "classKeys": ["BSCCS-FY-A"], "weekly": 2, "teacher": "KG"}, {"subjectCode": "BSCCS201_DS_LAB_2", "classKeys": ["BSCCS-SY-A"], "weekly": 2, "teacher": "HV"}, {"subjectCode": "BSCCS201_JAVA_LAB_2", "classKeys": ["BSCCS-SY-A"], "weekly": 2, "teacher": "RSW"}, {"subjectCode": "BSCCS201_OS_LAB_2", "classKeys": ["BSCCS-SY-A"], "weekly": 2, "teacher": "AG"}, {"subjectCode": "BSCCS301_WSN_LAB_2", "classKeys": ["BSCCS-TY-A"], "weekly": 2, "teacher": "VN"}, {"subjectCode": "BSCCS301_AI_LAB_2", "classKeys": ["BSCCS-TY-A"], "weekly": 2, "teacher": "KG"}, {"subjectCode": "BSCCS301_EH_LAB_2", "classKeys": ["BSCCS-TY-A"], "weekly": 2, "teacher": "HV"}, {"subjectCode": "BSCCS301_CIS_LAB_2", "classKeys": ["BSCCS-TY-A"], "weekly": 2, "teacher": "RSW"}, {"subjectCode": "BSCCS301_LINUX_LAB_2", "classKeys": ["BSCCS-TY-A"], "weekly": 2, "teacher": "AG"}, {"subjectCode": "BSC301_MJ_PRACT_H_AND_I_PRACT_ZOO", "classKeys": ["BSC-TY-ZOO"], "weekly": 2, "teacher": "KD"}, {"subjectCode": "BSC301_MJ_PRACT_H_AND_I_PRACT_CHEM", "classKeys": ["BSC-TY-Chemistry"], "weekly": 2, "teacher": "HP"}, {"subjectCode": "BMS101_WD_LAB_1", "classKeys": ["BCOMMS-FY-A"], "weekly": 2, "teacher": "VN"}, {"subjectCode": "BMS101_OST_LAB_1", "classKeys": ["BCOMMS-FY-A"], "weekly": 2, "teacher": "HV"}, {"subjectCode": "BMS201_UI_UX_LAB_1", "classKeys": ["BCOMMS-SY-HR", "BCOMMS-SY-Finance"], "weekly": 2, "teacher": "MMA"}, {"subjectCode": "BCOM101_WD_LAB_1", "classKeys": ["BCOM-FY-A"], "weekly": 2, "teacher": "VN"}, {"subjectCode": "BCOM101_OST_LAB_1", "classKeys": ["BCOM-FY-A"], "weekly": 2, "teacher": "HV"}, {"subjectCode": "BCOM201_UI_UX_LAB_1", "classKeys": ["BCOM-SY-A"], "weekly": 2, "teacher": "MMA"}];

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

  console.log('\n✓ Seed completed without Urdu/Marathi subjects.');
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