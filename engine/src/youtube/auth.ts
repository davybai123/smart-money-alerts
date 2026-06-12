import { google, Auth, youtube_v3 } from 'googleapis';
import { createLogger } from '../lib/logger';

const log = createLogger('youtube/auth');

let _oauth2Client: Auth.OAuth2Client | null = null;

/**
 * Return a singleton OAuth2Client configured with credentials from env.
 */
export function getOAuth2Client(): Auth.OAuth2Client {
  if (_oauth2Client) return _oauth2Client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI ?? 'urn:ietf:wg:oauth:2.0:oob';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('YOUTUBE_REFRESH_TOKEN must be set');
  }

  client.setCredentials({ refresh_token: refreshToken });

  // Listen for token refresh events so we can log them.
  client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      log.info('OAuth2 access token refreshed', {
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'unknown',
      });
    }
  });

  _oauth2Client = client;
  return _oauth2Client;
}

/**
 * Return an authenticated YouTube Data API v3 client.
 */
export function getYouTubeClient(): youtube_v3.Youtube {
  const auth = getOAuth2Client();
  return google.youtube({ version: 'v3', auth });
}

/**
 * Check the current access token and proactively refresh it if it expires
 * within the next 5 minutes.
 */
export async function refreshTokenIfNeeded(client: Auth.OAuth2Client): Promise<void> {
  const credentials = client.credentials;
  const expiryDate = credentials.expiry_date;

  const fiveMinutesMs = 5 * 60 * 1000;
  const needsRefresh =
    !expiryDate || Date.now() >= expiryDate - fiveMinutesMs;

  if (needsRefresh) {
    log.info('Access token expiring soon — refreshing');
    try {
      const { credentials: refreshed } = await client.refreshAccessToken();
      client.setCredentials(refreshed);
      log.info('Token refreshed successfully', {
        expiry: refreshed.expiry_date
          ? new Date(refreshed.expiry_date).toISOString()
          : 'unknown',
      });
    } catch (err) {
      log.error('Failed to refresh access token', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  } else {
    log.debug('Access token is still valid', {
      expiresIn: Math.round((expiryDate - Date.now()) / 1000) + 's',
    });
  }
}
