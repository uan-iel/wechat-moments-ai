const fs = require("node:fs");
const path = require("node:path");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DEFAULT_PROJECT_SLUG = "default-project";
const DEFAULT_PROJECT_NAME = "默认项目";
const defaultMemoryPath = path.join(process.cwd(), ".local-memory", "project-memory.json");
const memoryPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultMemoryPath;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readMemoryFile() {
  if (!fs.existsSync(memoryPath)) {
    throw new Error(`Project memory file not found: ${memoryPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(memoryPath, "utf8"));
  const projectSlug = cleanString(parsed.projectSlug) || process.env.MEMORY_PROJECT_SLUG || DEFAULT_PROJECT_SLUG;
  const projectName = cleanString(parsed.projectName) || process.env.MEMORY_PROJECT_NAME || DEFAULT_PROJECT_NAME;

  return {
    projectSlug,
    projectName,
    projectDescription: cleanString(parsed.projectDescription) || null,
    momentsStyleMemory: cleanString(parsed.momentsStyleMemory) || null,
    xiaohongshuStyleMemory: cleanString(parsed.xiaohongshuStyleMemory) || null
  };
}

async function main() {
  const memory = readMemoryFile();
  const project = await prisma.brandProject.upsert({
    where: {
      slug: memory.projectSlug
    },
    update: {
      name: memory.projectName,
      description: memory.projectDescription,
      momentsStyleMemory: memory.momentsStyleMemory,
      xiaohongshuStyleMemory: memory.xiaohongshuStyleMemory
    },
    create: {
      name: memory.projectName,
      slug: memory.projectSlug,
      description: memory.projectDescription,
      momentsStyleMemory: memory.momentsStyleMemory,
      xiaohongshuStyleMemory: memory.xiaohongshuStyleMemory
    }
  });

  console.log(`Imported project memory into "${project.name}" from ${memoryPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
