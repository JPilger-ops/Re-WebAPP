import { prisma } from "./prisma.js";

export async function getSmtpSettings() {
  const row = await prisma.smtp_settings.findUnique({ where: { id: 1 } });
  if (!row) return null;
  const { pass_value, ...rest } = row;
  return { ...rest, has_password: Boolean(pass_value) };
}

export async function saveSmtpSettings(input = {}) {
  const {
    host = null,
    port = null,
    secure = false,
    user = null,
    pass_value,
    from = null,
    reply_to = null,
  } = input;

  const data = {
    host: host || null,
    port: port ? Number(port) : null,
    secure: secure === true || secure === "true",
    user: user || null,
    from: from || null,
    reply_to: reply_to || null,
    updated_at: new Date(),
  };

  if (pass_value !== undefined) {
    data.pass_value = pass_value || null;
  }

  const saved = await prisma.smtp_settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  const { pass_value: _, ...rest } = saved;
  return { ...rest, has_password: Boolean(saved.pass_value) };
}

export function resolveGlobalSmtpFromEnv() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass && from) {
    return {
      host,
      port,
      secure,
      authUser: user,
      authPass: pass,
      from,
      reply_to: process.env.SMTP_REPLY_TO || null,
    };
  }
  return null;
}

export async function resolveGlobalSmtpFromDb() {
  const row = await prisma.smtp_settings.findUnique({ where: { id: 1 } });
  if (!row || !row.host) return null;
  if (!row.user || !row.pass_value || !row.from) return null;
  return {
    host: row.host,
    port: row.port || 587,
    secure: row.secure ?? false,
    authUser: row.user,
    authPass: row.pass_value,
    from: row.from,
    reply_to: row.reply_to || null,
  };
}
