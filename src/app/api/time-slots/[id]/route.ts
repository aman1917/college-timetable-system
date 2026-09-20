import { createItemHandlers } from '@/lib/crud';
import { timeSlotConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(timeSlotConfig);
