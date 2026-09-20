import { createItemHandlers } from '@/lib/crud';
import { academicYearConfig } from '../route';

export const { PUT, DELETE } = createItemHandlers(academicYearConfig);
