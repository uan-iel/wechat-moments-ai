const fs = require("node:fs");
const path = require("node:path");

const { ContentPlatform, ProductAssetType, PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const defaultMemoryPath = path.join(process.cwd(), ".local-memory", "reference-memory.json");
const memoryPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultMemoryPath;
const DEFAULT_PROJECT_SLUG = "default-project";
const DEFAULT_PROJECT_NAME = "默认项目";

function normalizePlatform(value) {
  return value === "XIAOHONGSHU" || value === "xiaohongshu"
    ? ContentPlatform.XIAOHONGSHU
    : ContentPlatform.MOMENTS;
}

function splitKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readMemoryFile() {
  if (!fs.existsSync(memoryPath)) {
    throw new Error(`Local memory file not found: ${memoryPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(memoryPath, "utf8"));

  if (!Array.isArray(parsed.formats)) {
    throw new Error("Local memory file must contain a formats array.");
  }

  return {
    projectSlug: String(parsed.projectSlug || process.env.MEMORY_PROJECT_SLUG || DEFAULT_PROJECT_SLUG).trim(),
    projectName: String(parsed.projectName || process.env.MEMORY_PROJECT_NAME || DEFAULT_PROJECT_NAME).trim(),
    projectDescription: parsed.projectDescription?.trim() || null,
    formats: parsed.formats
  };
}

async function ensureProject(input) {
  return prisma.brandProject.upsert({
    where: {
      slug: input.projectSlug
    },
    update: {
      name: input.projectName || input.projectSlug,
      description: input.projectDescription
    },
    create: {
      name: input.projectName || input.projectSlug,
      slug: input.projectSlug,
      description: input.projectDescription
    }
  });
}

async function upsertFormat(projectId, entry) {
  const platform = normalizePlatform(entry.platform);
  const name = String(entry.name || "").trim();

  if (!name) {
    throw new Error("Every content format needs a name.");
  }

  const existingFormat = await prisma.contentFormat.findFirst({
    where: {
      projectId,
      platform,
      name
    }
  });

  return existingFormat
    ? prisma.contentFormat.update({
        where: { id: existingFormat.id },
        data: {
          description: entry.description?.trim() || null,
          writingGuide: entry.writingGuide?.trim() || null
        }
      })
    : prisma.contentFormat.create({
        data: {
          projectId,
          platform,
          name,
          description: entry.description?.trim() || null,
          writingGuide: entry.writingGuide?.trim() || null
        }
      });
}

async function upsertProduct(contentFormatId, entry) {
  const name = String(entry.name || "").trim();

  if (!name) {
    throw new Error("Every product needs a name.");
  }

  const existingProduct = await prisma.product.findFirst({
    where: {
      contentFormatId,
      name
    }
  });
  const sellingPoints = splitKeywords(entry.keywords || entry.sellingPoints);

  return existingProduct
    ? prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          description: entry.description?.trim() || null,
          sellingPoints: Array.from(new Set([...existingProduct.sellingPoints, ...sellingPoints]))
        }
      })
    : prisma.product.create({
        data: {
          contentFormatId,
          name,
          description: entry.description?.trim() || null,
          sellingPoints
        }
      });
}

async function upsertMemoryAsset(productId, entry, index) {
  const title = String(entry.title || `本地记忆 ${index + 1}`).trim();
  const content = String(entry.content || "").trim();

  if (!content) {
    return;
  }

  const existingAsset = await prisma.productAsset.findFirst({
    where: {
      productId,
      type: ProductAssetType.TEXT,
      title
    }
  });
  const data = {
    type: ProductAssetType.TEXT,
    title,
    content,
    tags: splitKeywords(entry.keywords || entry.tags)
  };

  if (existingAsset) {
    await prisma.productAsset.update({
      where: { id: existingAsset.id },
      data
    });
    return;
  }

  await prisma.productAsset.create({
    data: {
      productId,
      ...data
    }
  });
}

async function main() {
  const memory = readMemoryFile();
  const project = await ensureProject(memory);

  for (const formatEntry of memory.formats) {
    const format = await upsertFormat(project.id, formatEntry);

    for (const productEntry of formatEntry.products || []) {
      const product = await upsertProduct(format.id, productEntry);

      for (const [index, memoryEntry] of (productEntry.memories || []).entries()) {
        await upsertMemoryAsset(product.id, memoryEntry, index);
      }
    }
  }

  console.log(`Imported local memory from ${memoryPath} into project "${project.name}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
