import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const run = (cmd) => {
  console.log(`[bootstrap] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
};

async function main() {
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
}

main()
  .catch((err) => {
    console.error("[bootstrap] Fehler:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
