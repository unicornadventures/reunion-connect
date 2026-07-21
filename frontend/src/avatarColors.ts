// Preset palette users can pick from for their profile circle, and the fallback
// used to derive a stable pseudo-random color for users who haven't picked one.
export const AVATAR_COLORS = [
  '#E91E63', '#3F51B5', '#009688', '#FF5722',
  '#9C27B0', '#4CAF50', '#FF9800', '#607D8B',
  '#795548', '#00BCD4', '#F06292', '#7986CB',
];

export const getColorForInitials = (initials: string): string => {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
