import "dotenv/config";

import { hash } from "bcryptjs";

import { UserRole } from "@/app/generated/prisma/enums";
import prisma from "@/lib/db/prisma";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Admin";

async function main() {
  if (!email || !password) {
    throw new Error(
      "Define ADMIN_EMAIL y ADMIN_PASSWORD para ejecutar el seed.",
    );
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email },
    select: {
      email: true,
      role: true,
    },
  });

  if (existingAdmin) {
    console.log(
      `Seed omitido: ${existingAdmin.email} (${existingAdmin.role}) ya existe`,
    );
    return;
  }

  const passwordHash = await hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
    },
    select: {
      email: true,
      role: true,
    },
  });

  console.log(`Seed completado: ${admin.email} (${admin.role})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
