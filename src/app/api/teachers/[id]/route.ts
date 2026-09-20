import { createItemHandlers } from '@/lib/crud';
import { teacherConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(teacherConfig);
