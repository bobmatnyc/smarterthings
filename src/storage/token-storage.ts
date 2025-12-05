import crypto from 'crypto';
import Database from 'better-sqlite3';
import logger from '../utils/logger.js';
import { environment } from '../config/environment.js';

/**
 * Encrypted OAuth token stored in database
 */
export interface EncryptedOAuthToken {
  id: number;
  userId: string;
  accessTokenEncrypted: string;
  accessTokenIv: string;
  accessTokenAuthTag: string;
  refreshTokenEncrypted: string;
  refreshTokenIv: string;
  refreshTokenAuthTag: string;
  expiresAt: number; // Unix timestamp
  scope: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Decrypted OAuth token for application use
 */
export interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

/**
 * Encrypted token components
 */
interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Token storage service with AES-256-GCM encryption.
 *
 * Design Decision: SQLite with encrypted columns
 * Rationale: Lightweight, serverless database with strong encryption for token security.
 *
 * Security:
 * - AES-256-GCM authenticated encryption
 * - Separate IV (initialization vector) for each token
 * - Auth tag for integrity verification
 * - Encryption key from environment variable (not in code)
 *
 * Trade-offs:
 * - Performance: Encryption overhead (~1ms per operation) vs. security
 * - Storage: Extra columns for IV and auth tag vs. single encrypted blob
 */
export class TokenStorage {
  private db: Database.Database;
  private encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(dbPath: string = './data/tokens.db') {
    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency

    // Derive encryption key from environment variable
    if (!environment.TOKEN_ENCRYPTION_KEY) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY environment variable is required for token storage'
      );
    }

    this.encryptionKey = crypto.scryptSync(
      environment.TOKEN_ENCRYPTION_KEY,
      'smartthings-mcp-salt', // Static salt (key derivation, not encryption)
      32 // 256 bits = 32 bytes
    );

    // Initialize database schema
    this.initializeSchema();

    logger.info('Token storage initialized', {
      dbPath,
      encryptionAlgorithm: this.algorithm,
    });
  }

  /**
   * Initialize database schema for OAuth tokens.
   *
   * Schema Design:
   * - Separate encrypted columns for access_token and refresh_token
   * - IV and auth tag stored separately for proper decryption
   * - Unix timestamps for expiration tracking
   * - userId for multi-user support (future)
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        access_token_encrypted TEXT NOT NULL,
        access_token_iv TEXT NOT NULL,
        access_token_auth_tag TEXT NOT NULL,
        refresh_token_encrypted TEXT NOT NULL,
        refresh_token_iv TEXT NOT NULL,
        refresh_token_auth_tag TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        scope TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at
        ON oauth_tokens(expires_at);

      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id
        ON oauth_tokens(user_id);
    `);

    logger.debug('Token storage schema initialized');
  }

  /**
   * Store OAuth tokens (encrypted).
   *
   * @param userId - User identifier (default: 'default' for single-user)
   * @param accessToken - Access token to encrypt and store
   * @param refreshToken - Refresh token to encrypt and store
   * @param expiresAt - Unix timestamp when access token expires
   * @param scope - OAuth scopes granted
   */
  storeTokens(
    userId: string = 'default',
    accessToken: string,
    refreshToken: string,
    expiresAt: number,
    scope: string
  ): void {
    const accessEncrypted = this.encryptToken(accessToken);
    const refreshEncrypted = this.encryptToken(refreshToken);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO oauth_tokens (
        user_id,
        access_token_encrypted,
        access_token_iv,
        access_token_auth_tag,
        refresh_token_encrypted,
        refresh_token_iv,
        refresh_token_auth_tag,
        expires_at,
        scope,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);

    stmt.run(
      userId,
      accessEncrypted.encrypted,
      accessEncrypted.iv,
      accessEncrypted.authTag,
      refreshEncrypted.encrypted,
      refreshEncrypted.iv,
      refreshEncrypted.authTag,
      expiresAt,
      scope
    );

    logger.info('OAuth tokens stored', {
      userId,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      scope,
    });
  }

  /**
   * Retrieve OAuth tokens (decrypted).
   *
   * @param userId - User identifier (default: 'default' for single-user)
   * @returns Decrypted tokens or null if not found
   */
  getTokens(userId: string = 'default'): OAuthToken | null {
    const stmt = this.db.prepare<[string], EncryptedOAuthToken>(`
      SELECT * FROM oauth_tokens WHERE user_id = ?
    `);

    const row = stmt.get(userId);

    if (!row) {
      logger.debug('No tokens found for user', { userId });
      return null;
    }

    try {
      const accessToken = this.decryptToken(
        row.accessTokenEncrypted,
        row.accessTokenIv,
        row.accessTokenAuthTag
      );

      const refreshToken = this.decryptToken(
        row.refreshTokenEncrypted,
        row.refreshTokenIv,
        row.refreshTokenAuthTag
      );

      logger.debug('OAuth tokens retrieved', {
        userId,
        expiresAt: new Date(row.expiresAt * 1000).toISOString(),
      });

      return {
        accessToken,
        refreshToken,
        expiresAt: row.expiresAt,
        scope: row.scope,
      };
    } catch (error) {
      logger.error('Failed to decrypt tokens', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Token decryption failed. Tokens may be corrupted.');
    }
  }

  /**
   * Delete OAuth tokens for a user.
   *
   * @param userId - User identifier (default: 'default' for single-user)
   */
  deleteTokens(userId: string = 'default'): void {
    const stmt = this.db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?');
    stmt.run(userId);

    logger.info('OAuth tokens deleted', { userId });
  }

  /**
   * Check if user has stored tokens.
   *
   * @param userId - User identifier (default: 'default' for single-user)
   * @returns True if tokens exist
   */
  hasTokens(userId: string = 'default'): boolean {
    const stmt = this.db.prepare<[string], { count: number }>(`
      SELECT COUNT(*) as count FROM oauth_tokens WHERE user_id = ?
    `);

    const result = stmt.get(userId);
    return result ? result.count > 0 : false;
  }

  /**
   * Encrypt token using AES-256-GCM.
   *
   * Security:
   * - AES-256-GCM provides authenticated encryption
   * - Random IV for each encryption (prevents pattern detection)
   * - Auth tag for integrity verification (detects tampering)
   *
   * @param token - Plaintext token to encrypt
   * @returns Encrypted token with IV and auth tag
   */
  private encryptToken(token: string): EncryptedData {
    // Generate random IV (initialization vector) for each encryption
    const iv = crypto.randomBytes(16); // 128 bits for GCM

    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt token using AES-256-GCM.
   *
   * @param encrypted - Encrypted token (hex string)
   * @param iv - Initialization vector (hex string)
   * @param authTag - Authentication tag (hex string)
   * @returns Decrypted plaintext token
   * @throws Error if decryption fails (wrong key, corrupted data, or tampered)
   */
  private decryptToken(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Close database connection.
   */
  close(): void {
    this.db.close();
    logger.debug('Token storage closed');
  }
}

/**
 * Singleton token storage instance.
 * Lazy-initialized on first access to avoid startup overhead.
 */
let tokenStorageInstance: TokenStorage | null = null;

/**
 * Get or create singleton token storage instance.
 *
 * Design Decision: Singleton pattern for token storage
 * Rationale: Single database connection shared across application.
 * Prevents multiple database connections and ensures consistency.
 *
 * @param dbPath - Database file path (default: './data/tokens.db')
 * @returns Singleton TokenStorage instance
 */
export function getTokenStorage(dbPath: string = './data/tokens.db'): TokenStorage {
  if (!tokenStorageInstance) {
    tokenStorageInstance = new TokenStorage(dbPath);
    logger.debug('Token storage singleton created', { dbPath });
  }
  return tokenStorageInstance;
}
