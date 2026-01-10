import { authenticator } from "otplib";
import qrcode from "qrcode";

const ISSUER = process.env.MFA_ISSUER || "RechnungsAPP";

authenticator.options = {
  window: 1,
};

export const generateMfaSecret = async (username) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(username, ISSUER, secret);
  const qr_code = await qrcode.toDataURL(otpauth);
  return { secret, otpauth_url: otpauth, qr_code };
};

export const verifyMfaToken = (secret, token) => {
  const cleaned = String(token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  return authenticator.verify({ token: cleaned, secret });
};
