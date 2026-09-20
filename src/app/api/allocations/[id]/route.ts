import { createItemHandlers } from '@/lib/crud';
import { allocationConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(allocationConfig);
