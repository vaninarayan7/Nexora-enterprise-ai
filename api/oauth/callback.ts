export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.query.code as string;
  const error = req.query.error;

  if (error) {
    return res.status(400).send(`OAuth Error: ${error}`);
  }
  if (!code) {
    return res.status(400).send("No authorization code provided.");
  }

  try {
    const baseUrl = process.env.APP_URL || (req.headers.host ? `https://${req.headers.host}` : "http://localhost:3001");
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const normalizedBase = baseUrl.replace(/\/$/, "");
    const redirectUri = `${normalizedBase}/api/oauth/callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).send("Google OAuth config is missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return res.status(tokenResponse.status).send(`Failed to exchange code: ${errText}`);
    }

    const tokenData = await tokenResponse.json();

    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <html>
        <head><title>OAuth Successful</title></head>
        <body>
          <p>Authentication successful! Returning to application...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "OAUTH_SUCCESS",
                accessToken: "${tokenData.access_token}",
                refreshToken: "${tokenData.refresh_token || ""}"
              }, "*");
              window.close();
            } else {
              document.body.innerHTML += "<p>Please close this window and refresh the application.</p>";
            }
          </script>
        </body>
      </html>
    `);
  } catch (e) {
    console.error("Error during OAuth callback:", e);
    res.status(500).send("Internal server error during OAuth callback.");
  }
}
