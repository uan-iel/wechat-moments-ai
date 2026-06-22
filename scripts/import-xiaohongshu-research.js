const fs = require("node:fs");
const path = require("node:path");

const { ContentPlatform, PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function readJson(filePath) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Research file not found: ${resolved}`);
  }

  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function normalizeArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.notes)) {
    return payload.notes;
  }

  return [];
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function toInteger(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.]/g, "");

    if (!cleaned) {
      return null;
    }

    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
  }

  return null;
}

function splitKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(String(item))).filter(Boolean);
  }

  return cleanString(String(value || ""))
    .split(/[#,\n，、|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveKeywords(note) {
  const keywordPool = [
    ...splitKeywords(note.tags),
    ...splitKeywords(note.tag_list),
    ...splitKeywords(note.keyword),
    ...splitKeywords(note.keywords),
    ...splitKeywords(note.note_tag),
    ...splitKeywords(note.title)
  ];

  return Array.from(new Set(keywordPool)).slice(0, 24);
}

function normalizeNote(note) {
  const title = cleanOptionalString(
    note.title ||
      note.display_title ||
      note.note_title ||
      note.note_card?.display_title ||
      note.note_card?.title
  );
  const content = cleanString(
    note.desc ||
      note.content ||
      note.note_desc ||
      note.note_card?.desc ||
      note.note_card?.display_desc ||
      note.note_card?.content ||
      ""
  );

  if (!content) {
    return null;
  }

  return {
    externalId: cleanOptionalString(note.note_id || note.id || note.noteCardId || note.note_card?.note_id),
    title,
    content,
    authorName: cleanOptionalString(
      note.nickname || note.user?.nickname || note.author?.nickname || note.note_card?.user?.nickname
    ),
    authorHandle: cleanOptionalString(
      note.user_id || note.user?.user_id || note.author?.user_id || note.note_card?.user?.user_id
    ),
    noteUrl: cleanOptionalString(note.note_url || note.url || note.note_card?.note_url),
    publishedAt: parseDate(note.time || note.publish_time || note.last_update_time || note.note_card?.time),
    keywords: deriveKeywords(note),
    likeCount: toInteger(note.liked_count || note.likes || note.note_card?.interact_info?.liked_count),
    commentCount: toInteger(note.comment_count || note.comments || note.note_card?.interact_info?.comment_count),
    collectCount: toInteger(note.collected_count || note.collects || note.note_card?.interact_info?.collected_count),
    shareCount: toInteger(note.share_count || note.shares || note.note_card?.interact_info?.share_count),
    viewCount: toInteger(note.view_count || note.views || note.note_card?.interact_info?.view_count),
    rawPayload: note
  };
}

async function upsertCollection({ name, sourceType, sourceQuery, description }) {
  const existing = await prisma.researchCollection.findFirst({
    where: {
      platform: ContentPlatform.XIAOHONGSHU,
      name
    }
  });

  if (existing) {
    return prisma.researchCollection.update({
      where: { id: existing.id },
      data: {
        sourceType,
        sourceQuery,
        description
      }
    });
  }

  return prisma.researchCollection.create({
    data: {
      platform: ContentPlatform.XIAOHONGSHU,
      name,
      sourceType,
      sourceQuery,
      description
    }
  });
}

async function upsertNote(collectionId, note) {
  const existing = note.externalId
    ? await prisma.researchNote.findFirst({
        where: {
          collectionId,
          externalId: note.externalId
        }
      })
    : await prisma.researchNote.findFirst({
        where: {
          collectionId,
          title: note.title || undefined,
          content: note.content
        }
      });

  if (existing) {
    await prisma.researchNote.update({
      where: { id: existing.id },
      data: note
    });
    return;
  }

  await prisma.researchNote.create({
    data: {
      collectionId,
      ...note
    }
  });
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error("Usage: npm run research:import:xhs -- <path-to-json> [collection-name]");
  }

  const collectionName = cleanString(process.argv[3] || "") || path.basename(filePath, path.extname(filePath));
  const sourceQuery = cleanOptionalString(process.argv[4] || "");
  const payload = readJson(filePath);
  const notes = normalizeArray(payload).map(normalizeNote).filter(Boolean);

  if (notes.length === 0) {
    throw new Error("No usable Xiaohongshu notes were found in the input file.");
  }

  const collection = await upsertCollection({
    name: collectionName,
    sourceType: "crawler-import",
    sourceQuery,
    description: `Imported from ${path.basename(filePath)}`
  });

  for (const note of notes) {
    await upsertNote(collection.id, note);
  }

  console.log(`Imported ${notes.length} Xiaohongshu notes into collection "${collection.name}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
