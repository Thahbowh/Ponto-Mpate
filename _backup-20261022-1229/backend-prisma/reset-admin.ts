import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@demo.example";
  const password = "PontoAdmin2026";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN" },
    create: { name: "Demo Admin", email, passwordHash, role: "ADMIN" },
  });
  console.log("Admin ready:", user.email);
}

main().finally(() => prisma.$disconnect());