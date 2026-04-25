/**
 * SEC EDGAR filings types — mirrors services/api/src/schemas/filings.py.
 *
 * Source: SEC EDGAR full-text search API (ADR-005).
 * These types are the frontend contract for GET /api/v1/filings endpoints.
 */

export type Filing = {
  /** Ticker symbol this filing belongs to. */
  symbol: string;
  /** Filing form type. One of: '10-K', '10-Q', '8-K'. */
  form_type: string;
  /** Date and time the filing was submitted — ISO 8601 UTC string. */
  filed_at: string;
  /** Period covered by the filing — ISO 8601 date string (YYYY-MM-DD). */
  period_of_report: string;
  /** EDGAR accession number, e.g. '0000320193-23-000106'. */
  accession_number: string;
  /** Full URL to the EDGAR filing index page. */
  filing_url: string;
  /** Optional short description extracted from the filing header. */
  description: string | null;
};

export type FilingsResponse = {
  /** Ticker symbol. */
  symbol: string;
  /** List of filings, newest first. */
  filings: Filing[];
  /** Total matching filings count. */
  total: number;
};
