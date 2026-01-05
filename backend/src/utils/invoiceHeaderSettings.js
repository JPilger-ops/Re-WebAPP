import { prisma } from "./prisma.js";

export async function getInvoiceHeaderSettings() {
  const row = await prisma.invoice_header_settings.findUnique({ where: { id: 1 } });
  if (!row) {
    return {
      id: 1,
      company_name: null,
      address_line1: null,
      address_line2: null,
      zip: null,
      city: null,
      country: null,
      phone: null,
      vat_id: null,
      bank_name: null,
      iban: null,
      bic: null,
      footer_text: null,
      logo_url: null,
      updated_at: null,
    };
  }
  return row;
}

export async function saveInvoiceHeaderSettings(input = {}) {
  const data = {
    company_name: input.company_name || null,
    address_line1: input.address_line1 || null,
    address_line2: input.address_line2 || null,
    zip: input.zip || null,
    city: input.city || null,
    country: input.country || null,
    phone: input.phone || null,
    vat_id: input.vat_id || null,
    bank_name: input.bank_name || null,
    iban: input.iban || null,
    bic: input.bic || null,
    footer_text: input.footer_text || null,
    logo_url: input.logo_url || null,
    updated_at: new Date(),
  };

  return prisma.invoice_header_settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
}
