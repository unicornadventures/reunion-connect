// Preset palette users can pick from for their profile circle. Must match
// frontend/src/avatarColors.ts.
export const AVATAR_COLORS = [
  '#E91E63', '#3F51B5', '#009688', '#FF5722',
  '#9C27B0', '#4CAF50', '#FF9800', '#607D8B',
  '#795548', '#00BCD4', '#F06292', '#7986CB',
];

export const isValidAvatarColor = (color: unknown): color is string =>
  typeof color === 'string' && AVATAR_COLORS.includes(color);
