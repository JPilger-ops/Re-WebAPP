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

async function main() {
  const adminRoleId = await seedRoles();
  await seedAdmin(adminRoleId);
}

main()
  .catch((err) => {
    console.error("[seed] Fehler:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
