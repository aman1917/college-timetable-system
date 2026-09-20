import { createItemHandlers } from '@/lib/crud';
import { streamConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(streamConfig);
