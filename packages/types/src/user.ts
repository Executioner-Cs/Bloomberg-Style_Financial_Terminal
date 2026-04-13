export type UserTier = 'free' | 'pro' | 'admin';

export type User = {
  id: string;
  email: string;
  tier: UserTier;
  createdAt: string;
  lastLoginAt: string | null;
};

export type UserSettings = {
  theme: 'dark' | 'light';
  fontSize: 'sm' | 'md' | 'lg';
  timezone: string;
  defaultWatchlistId: string | null;
  compactMode: boolean;
};
