import { createCollectionHandlers } from '@/lib/crud';
import { syllabusSchema } from '@/lib/schemas';

export const syllabusConfig = {
  model: 'syllabus' as const,
  label: 'Syllabus',
  schema: syllabusSchema,
  allowTeacherRead: true,
  findManyArgs: { include: { subject: true } },
  describe: (r: unknown) => (r as { subjectId: string }).subjectId,
};

export const { GET, POST } = createCollectionHandlers(syllabusConfig);
