import fs from "fs";
import path from "path";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipient, recipients, cc, bcc, subject, body, token, refreshToken, type = "manual" } = req.body;

    const toList: string[] = Array.isArray(recipients) && recipients.length > 0
      ? recipients
      : (recipient ? [recipient] : []);

    if (toList.length === 0 || !subject || !body || !token) {
      return res.status(400).json({ error: "Missing required fields: recipients (or recipient), subject, body, token." });
    }

    const toHeader = toList.join(", ");
    const ccHeader = Array.isArray(cc) && cc.length > 0 ? cc.join(", ") : "";
    const bccHeader = Array.isArray(bcc) && bcc.length > 0 ? bcc.join(", ") : "";

    const rfcEmailLines = [
      `To: ${toHeader}`,
      ...(ccHeader ? [`Cc: ${ccHeader}`] : []),
      ...(bccHeader ? [`Bcc: ${bccHeader}`] : []),
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      ``,
      `<div style="font-family: system-ui, sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">`,
      `  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">`,
      `    <h2 style="color: #6366f1; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Nexora Email Assistant</h2>`,
      `  </div>`,
      `  <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">`,
      `    ${body.replace(/\n/g, "<br/>")}`,
      `  </div>`,
      `  <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 24px; font-weight: 500;">`,
      `    This email is dispatched securely using your Google Workspace Gmail credentials.<br/>`,
      `    Nexora AI Enterprise • Confidential Transmission`,
      `  </p>`,
      `</div>`
    ];

    const base64UrlEmail = Buffer.from(rfcEmailLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const gmailApiUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    let currentToken = token;
    let gResponse = await fetch(gmailApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${currentToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: base64UrlEmail })
    });

    if (!gResponse.ok && (gResponse.status === 401 || gResponse.status === 403) && refreshToken) {
      console.log("Token expired or unauthorized, attempting to refresh token...");
      try {
        const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
        const clientId = config.oAuthClientId;
        const clientSecret = config.oAuthClientSecret;
        
        if (clientId && clientSecret) {
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

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            currentToken = tokenData.access_token;
            
            gResponse = await fetch(gmailApiUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${currentToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ raw: base64UrlEmail })
            });
          }
        }
      } catch (err) {
        console.error("Token refresh failed during send:", err);
      }
    }

    if (!gResponse.ok) {
      const errText = await gResponse.text();
      return res.status(gResponse.status).json({ error: "Failed to send email via Gmail API", details: errText });
    }

    const data = await gResponse.json();
    const logId = `log-${Date.now()}`;
    const log = {
      id: logId,
      recipient: toHeader,
      subject,
      body: "Email content processed securely.",
      timestamp: new Date().toISOString(),
      status: "success",
      type
    };

    return res.json({ success: true, messageId: data.id, log, refreshedToken: currentToken !== token ? currentToken : undefined });
  } catch (err: any) {
    console.error("Email send error:", err);
    return res.status(500).json({ error: "Internal server error during email dispatch.", details: err.message, stack: err.stack });
  }
}
