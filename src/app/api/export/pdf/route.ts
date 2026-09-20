import { handleError, requireSession } from '@/lib/api';
import { loadContext } from '@/lib/timetable-service';
import { buildExportTable, type ExportKind } from '@/lib/export-data';
import { hexToRgb } from '@/lib/colors';
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

    // Imported here rather than at module scope so these libraries load only
    // when an export is actually requested.
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFontSize(15);
    doc.text(settings?.collegeName ?? 'College', 40, 40);
    doc.setFontSize(11);
    doc.text(`${table.title} — ${table.subtitle}`, 40, 58);
    doc.setFontSize(8);
    doc.text(
      `Status: ${settings?.timetableStatus ?? 'DRAFT'}   |   Generated ${new Date().toLocaleString()}`,
      40,
      72,
    );

    autoTable(doc, {
      startY: 84,
      head: [table.head],
      body: table.rows.map((row) => row.map((cell) => cell.text)),
      styles: { fontSize: 7, cellPadding: 3, valign: 'middle', halign: 'center', lineWidth: 0.4 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' } },
      // Subject colours are the point of a printed timetable, so each cell is
      // painted from the subject's own colour.
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const cell = table.rows[data.row.index]?.[data.column.index];
        if (!cell?.color) return;
        const [r, g, b] = hexToRgb(cell.color);
        data.cell.styles.fillColor = [r, g, b];
        data.cell.styles.textColor = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? 20 : 255;
      },
    });

    if (table.legend.length > 0) {
      const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
      doc.setFontSize(9);
      doc.text('Subject Legend', 40, endY);
      autoTable(doc, {
        startY: endY + 6,
        head: [['', 'Code', 'Subject']],
        body: table.legend.map((l) => ['', l.code, l.name]),
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 70, fontStyle: 'bold' } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const [r, g, b] = hexToRgb(table.legend[data.row.index].color);
            data.cell.styles.fillColor = [r, g, b];
          }
        },
      });
    }

    const bytes = doc.output('arraybuffer');
    const filename = `timetable-${kind}-${table.subtitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;

    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
