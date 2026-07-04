import { brandColors } from '../../../theme/colors';
import type { ServiceType } from '../../../types/catalog.types';

export const CAT_COLORS: Record<ServiceType, { color: string; bg: string }> = {
  api:  { color: brandColors.tealBright, bg: 'rgba(5,182,183,0.14)' },
  db:   { color: brandColors.royalBlue,  bg: 'rgba(0,64,161,0.12)' },
  web:  { color: brandColors.navy,       bg: 'rgba(2,30,73,0.10)' },
  ml:   { color: brandColors.oceanBlue,  bg: 'rgba(2,87,148,0.12)' },
  tool: { color: brandColors.teal,       bg: 'rgba(4,142,157,0.14)' },
};