/**
 * LreAuthenticator — placeholder file.
 *
 * Authentication is currently handled directly inside LreClient:
 *   - Username/password → authenticateWithPassword() (GET + Basic header)
 *   - API token        → authenticateWithToken()     (POST XML to authenticateclient)
 *
 * If authentication logic grows (e.g. token refresh, OAuth flows) this file is
 * the right place to extract it.  Until then nothing lives here.
 */
