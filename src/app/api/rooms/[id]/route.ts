import { createItemHandlers } from '@/lib/crud';
import { roomConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(roomConfig);
