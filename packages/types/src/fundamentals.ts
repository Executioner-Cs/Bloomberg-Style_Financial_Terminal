export type PeriodType = 'annual' | 'quarterly';

export type IncomeStatement = {
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  epsDiluted: number | null;
  ebitda: number | null;
};

export type BalanceSheet = {
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  cashAndEquivalents: number | null;
  totalDebt: number | null;
  netDebt: number | null;
};

export type CashFlowStatement = {
  operatingCashFlow: number | null;
  capitalExpenditures: number | null;
  freeCashFlow: number | null;
  dividendsPaid: number | null;
};

export type FinancialRatios = {
  peRatio: number | null;
  pbRatio: number | null;
  evToEbitda: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
};

export type FundamentalsRecord = {
  instrumentId: string;
  periodType: PeriodType;
  periodEnd: string;
  source: string;
  incomeStmt: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlow: CashFlowStatement;
  ratios: FinancialRatios;
  fetchedAt: string;
};
