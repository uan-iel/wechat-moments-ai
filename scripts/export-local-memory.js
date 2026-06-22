const fs = require("node:fs");
const path = require("node:path");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), ".local-memory", "reference-memory-export.json");

async function main() {
  const formats = await prisma.contentFormat.findMany({
    orderBy: [{ platform: "asc" }, { name: "asc" }],
    include: {
      products: {
        orderBy: { name: "asc" },
        include: {
          assets: {
            orderBy: [{ type: "asc" }, { title: "asc" }]
          }
        }
      }
    }
  });
  const payload = {
    exportedAt: new Date().toISOString(),
    formats: formats.map((format) => ({
      platform: format.platform,
      name: format.name,
      description: format.description,
      writingGuide: format.writingGuide,
      products: format.products.map((product) => ({
        name: product.name,
        description: product.description,
        keywords: product.sellingPoints,
        memories: product.assets.map((asset) => ({
          title: asset.title,
          type: asset.type,
          keywords: asset.tags,
          content: asset.content,
          imageUrl: asset.imageUrl,
          imageAnalysis: asset.imageAnalysis
        }))
      }))
    }))
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Exported local memory to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
