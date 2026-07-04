export const brandColors = {
  navyDarkest: '#01193A',
  navy: '#021E49',
  oceanBlue: '#025794',
  royalBlue: '#0040A1',
  teal: '#048E9D',
  tealBright: '#05B6B7',
  tealLight: '#D7F2F6',
  background: '#FDFDFD',
} as const;

export type BrandColor = keyof typeof brandColors;