import { createItemHandlers } from '@/lib/crud';
import { syllabusConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(syllabusConfig);
