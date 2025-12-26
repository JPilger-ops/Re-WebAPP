import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "admin";
const DEFAULT_PERMISSIONS = [
  "invoices.read",
  "invoices.create",
  "invoices.update",
  "invoices.export",
  "invoices.delete",
  "stats.view",
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.delete",
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
  "users.resetPassword",
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",
  "settings.general",
  "categories.read",
  "categories.write",
  "categories.delete",
];

async function seedRoles() {
  const adminRole = await prisma.roles.upsert({
    where: { name: "admin" },
    update: { description: "Voller Zugriff" },
    create: { name: "admin", description: "Voller Zugriff" },
  });

  await prisma.roles.upsert({
    where: { name: "user" },
    update: { description: "Standardnutzer" },
    create: { name: "user", description: "Standardnutzer" },
  });

  await prisma.role_permissions.createMany({
    data: DEFAULT_PERMISSIONS.map((permission_key) => ({
      role_id: adminRole.id,
      permission_key,
    })),
    skipDuplicates: true,
  });

  return adminRole.id;
}

async function seedAdmin(adminRoleId) {
  const existing = await prisma.users.findUnique({
    where: { username: "admin" },
  });

  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: {
        role: "admin",
        role_id: adminRoleId,
      },
    });
    return;
  }

  const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  await prisma.users.create({
    data: {
      username: "admin",
      password_hash: hash,
      role: "admin",
      role_id: adminRoleId,
      is_active: true,
    },
  });
  console.log(`[seed] Admin-User angelegt (admin / ${DEFAULT_ADMIN_PASSWORD})`);
}

async function seedSmtpSettings() {
  await prisma.smtp_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      host: null,
      port: null,
      secure: false,
      user: null,
      pass_value: null,
      from: null,
      reply_to: null,
    },
  });
}

async function seedInvoiceHeader() {
  await prisma.invoice_header_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      company_name: null,
      address_line1: null,
      address_line2: null,
      zip: null,
      city: null,
      country: null,
      vat_id: null,
      bank_name: null,
      iban: null,
      bic: null,
      footer_text: null,
      logo_url: null,
    },
  });
}

async function seedBank() {
  const fallbackName = process.env.SEPA_CREDITOR_NAME || "Waldwirtschaft Heidekönig";
  const fallbackBank = process.env.BANK_NAME || "VR-Bank Bonn Rhein-Sieg eG";
  const fallbackIban = (process.env.SEPA_CREDITOR_IBAN || "DE48370695201104185025").replace(/\s+/g, "");
  const fallbackBic = (process.env.SEPA_CREDITOR_BIC || "GENODED1RST").replace(/\s+/g, "").toUpperCase();

  await prisma.bank_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      account_holder: fallbackName,
      bank_name: fallbackBank,
      iban: fallbackIban,
      bic: fallbackBic,
    },
  });
}

async function seedTax() {
  await prisma.tax_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      tax_number: null,
      vat_id: null,
    },
  });
}

async function seedDatev() {
  await prisma.datev_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      email: null,
    },
  });
}

async function seedHkforms() {
  const DEFAULT_BASE_URL = "https://app.bistrottelegraph.de/api";
  const base_url = (process.env.HKFORMS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "") || DEFAULT_BASE_URL;
  const organization = process.env.HKFORMS_ORGANIZATION || null;

  await prisma.hkforms_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      base_url,
      organization,
      api_key: null,
    },
  });
}

async function seedPdfSettings() {
  const fallback = process.env.PDF_STORAGE_PATH || "/app/pdfs";
  await prisma.pdf_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storage_path: fallback,
    },
  });
}

async function seedEmailTemplates() {
  await prisma.email_templates.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      subject_template: "Rechnung {{invoice_number}}",
      body_html_template: null,
      body_text_template:
        "Hallo {{recipient_name}},\\n\\nanbei erhältst du deine Rechnung Nr. {{invoice_number}} vom {{invoice_date}}.\\nDer Betrag von {{amount}} ist fällig bis {{due_date}}.\\n\\nVielen Dank!\\n{{company_name}}",
    },
  });
}

async function seedFaviconSettings() {
  await prisma.favicon_settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      filename: "logos/RE-WebAPP.png",
    },
  });
}

async function main() {
  const adminRoleId = await seedRoles();
  await seedAdmin(adminRoleId);
  await seedSmtpSettings();
  await seedInvoiceHeader();
  await seedBank();
  await seedTax();
  await seedDatev();
  await seedHkforms();
  await seedPdfSettings();
  await seedEmailTemplates();
  await seedFaviconSettings();
}

main()
  .catch((err) => {
    console.error("[seed] Fehler:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
