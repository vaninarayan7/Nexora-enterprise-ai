export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "No refresh token provided." });

    const baseUrl = process.env.APP_URL || (req.headers.host ? `https://${req.headers.host}` : "http://localhost:3001");
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Google OAuth config is missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables." });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return res.status(tokenResponse.status).json({ error: `Failed to refresh token: ${errText}` });
    }

    const tokenData = await tokenResponse.json();
    return res.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      token_type: tokenData.token_type
    });
  } catch (e: any) {
    console.error("Error refreshing token:", e);
    return res.status(500).json({ error: "Internal server error during token refresh.", details: e.message });
  }
}
