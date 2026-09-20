import { createItemHandlers } from '@/lib/crud';
import { classConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(classConfig);
