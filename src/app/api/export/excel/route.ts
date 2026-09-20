import { handleError, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';
import { buildExportTable, type ExportKind } from '@/lib/export-data';
import { contrastText, toArgb } from '@/lib/colors';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const kind = (url.searchParams.get('kind') ?? 'master') as ExportKind;
    const id = url.searchParams.get('id') ?? 'all';

    const [ctx, settings] = await Promise.all([
      loadContext(),
      prisma.appSetting.findUnique({ where: { id: 'singleton' } }),
    ]);
    const table = buildExportTable(ctx, kind, id);

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = settings?.collegeName ?? 'CampusGrid';
    const sheet = workbook.addWorksheet('Timetable', {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    sheet.addRow([settings?.collegeName ?? 'College']).font = { bold: true, size: 14 };
    sheet.addRow([`${table.title} — ${table.subtitle}`]).font = { bold: true, size: 11 };
    sheet.addRow([`Status: ${settings?.timetableStatus ?? 'DRAFT'} · Generated ${new Date().toLocaleString()}`]);
    sheet.addRow([]);

    const headerRow = sheet.addRow(table.head);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const row of table.rows) {
      const excelRow = sheet.addRow(row.map((cell) => cell.text));
      excelRow.height = 42;
      excelRow.eachCell((cell, colNumber) => {
        const source = row[colNumber - 1];
        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
        if (source?.color) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(source.color) } };
          cell.font = { color: { argb: toArgb(contrastText(source.color)) }, size: 9 };
        }
      });
    }

    sheet.getColumn(1).width = 12;
    for (let i = 2; i <= table.head.length; i++) sheet.getColumn(i).width = 22;

    if (table.legend.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['Subject Legend']).font = { bold: true };
      for (const item of table.legend) {
        const row = sheet.addRow(['', item.code, item.name]);
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(item.color) } };
        row.getCell(2).font = { bold: true };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `timetable-${kind}-${table.subtitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
