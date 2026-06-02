import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("seeding start into db...");

  // 1. Clean existing database records
  await prisma.task.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // 2. A single User 
  const user = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@gmail.com",
      name: "Admin User",
      password: "adminpassword",  
      role: Role.ADMIN,
    },
  });

  // 3. Project creation
  await prisma.project.create({
    data: {
      name: "Default Workspace Project",
      description: "This is a simple seeded project for initial setup testing.",
      userId: user.id,
    },
  });

  console.log("🎉 Created user and project");
}

main()
  .catch((e) => {
    console.error(" Error occurred during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
