export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // In production, APP_URL should be set in Vercel environment variables (e.g. https://nexora-enterprise-ai.vercel.app)
    const baseUrl = process.env.APP_URL || (req.headers.host ? `https://${req.headers.host}` : "http://localhost:3001");
    
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const normalizedBase = baseUrl.replace(/\/$/, "");
    const redirectUri = `${normalizedBase}/api/oauth/callback`;

    if (!clientId) {
      return res.status(500).send("GOOGLE_CLIENT_ID is missing. Add GOOGLE_CLIENT_ID to your environment variables.");
    }

    if (!clientSecret) {
      return res.status(500).send("GOOGLE_CLIENT_SECRET is missing. Add GOOGLE_CLIENT_SECRET to your environment variables.");
    }

    let scope = "https://www.googleapis.com/auth/calendar.events";
    if (req.query.type === "gmail") {
      scope = "https://www.googleapis.com/auth/gmail.send";
    } else if (req.query.type === "both") {
      scope = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send";
    }
    
    // Maintain state to know where to redirect after or what type of token it is
    const state = req.query.type || "calendar";

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&include_granted_scopes=true&state=${encodeURIComponent(state)}`;

    res.redirect(authUrl);
  } catch (e) {
    console.error("Error initiating OAuth:", e);
    res.status(500).send("Failed to initiate OAuth.");
  }
}
