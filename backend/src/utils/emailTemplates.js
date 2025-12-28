import { prisma } from "./prisma.js";

export const getGlobalEmailTemplate = async () => {
  return prisma.email_templates.findUnique({ where: { id: 1 } });
};

export const saveGlobalEmailTemplate = async ({ subject_template, body_html_template, body_text_template }) => {
  return prisma.email_templates.upsert({
    where: { id: 1 },
    update: {
      subject_template,
      body_html_template,
      body_text_template,
      updated_at: new Date(),
    },
    create: {
      id: 1,
      subject_template,
      body_html_template,
      body_text_template,
    },
  });
};
