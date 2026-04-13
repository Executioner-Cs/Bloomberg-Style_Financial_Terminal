export type AlertType = 'price_above' | 'price_below' | 'pct_change';

export type Alert = {
  id: string;
  symbol: string;
  alertType: AlertType;
  threshold: number;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
};

export type CreateAlertRequest = {
  symbol: string;
  alertType: AlertType;
  threshold: number;
};
