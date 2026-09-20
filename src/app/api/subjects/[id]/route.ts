import { createItemHandlers } from '@/lib/crud';
import { subjectConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(subjectConfig);
