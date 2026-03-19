/**
 * IntegrationService — base interface and shared helpers for third-party integrations.
 *
 * Concrete integrations (e.g. Lightroom) implement this interface.
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Absolute timestamp when the access token expires */
  expiresAt: Date;
  /** When these tokens were originally issued */
  issuedAt: Date;
}

export interface SyncResult {
  success: boolean;
  /** Number of items successfully synced */
  synced: number;
  error?: string;
}

export interface IntegrationStatus {
  configured: boolean;
  connected: boolean;
  /** Whether the user needs to re-authorize (e.g. >90 days since issuance) */
  needsReauth: boolean;
  /** ISO string of token issuance date, if connected */
  issuedAt?: string;
}

/**
 * Base interface all integrations must satisfy.
 */
export interface IntegrationService {
  /** Returns current connection status for a given user */
  getStatus(userId: string): Promise<IntegrationStatus>;

  /** Stores encrypted tokens after a successful OAuth callback */
  storeTokens(userId: string, tokens: OAuthTokens): Promise<void>;

  /** Removes stored tokens (disconnect) */
  revokeTokens(userId: string): Promise<void>;

  /** Refreshes the access token using the stored refresh token */
  refreshAccessToken(userId: string): Promise<OAuthTokens>;
}

/** 90-day threshold in milliseconds for re-auth prompt */
export const REAUTH_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;
