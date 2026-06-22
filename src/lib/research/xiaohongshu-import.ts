import { ContentPlatform, Prisma, PrismaClient } from "@prisma/client";

type ImportablePrisma = PrismaClient;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function toInteger(value: unknown) {
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

function splitKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(String(item))).filter(Boolean);
  }

  return cleanString(String(value || ""))
    .split(/[#,\n，、|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDate(value: unknown) {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveKeywords(note: Record<string, unknown>) {
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

function normalizeArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const objectPayload = payload as Record<string, unknown>;
  const candidates = [objectPayload.items, objectPayload.data, objectPayload.notes];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    }
  }

  return [];
}

function normalizeNote(note: Record<string, unknown>) {
  const noteCard = (note.note_card && typeof note.note_card === "object" ? note.note_card : {}) as Record<string, unknown>;
  const user = (note.user && typeof note.user === "object" ? note.user : {}) as Record<string, unknown>;
  const author = (note.author && typeof note.author === "object" ? note.author : {}) as Record<string, unknown>;
  const noteCardUser =
    noteCard.user && typeof noteCard.user === "object" ? (noteCard.user as Record<string, unknown>) : {};
  const interactInfo =
    noteCard.interact_info && typeof noteCard.interact_info === "object"
      ? (noteCard.interact_info as Record<string, unknown>)
      : {};

  const title = cleanOptionalString(note.title || note.display_title || note.note_title || noteCard.display_title || noteCard.title);
  const content = cleanString(
    note.desc || note.content || note.note_desc || noteCard.desc || noteCard.display_desc || noteCard.content || ""
  );

  if (!content) {
    return null;
  }

  return {
    externalId: cleanOptionalString(note.note_id || note.id || note.noteCardId || noteCard.note_id),
    title,
    content,
    authorName: cleanOptionalString(note.nickname || user.nickname || author.nickname || noteCardUser.nickname),
    authorHandle: cleanOptionalString(note.user_id || user.user_id || author.user_id || noteCardUser.user_id),
    noteUrl: cleanOptionalString(note.note_url || note.url || noteCard.note_url),
    publishedAt: parseDate(note.time || note.publish_time || note.last_update_time || noteCard.time),
    keywords: deriveKeywords(note),
    likeCount: toInteger(note.liked_count || note.likes || interactInfo.liked_count),
    commentCount: toInteger(note.comment_count || note.comments || interactInfo.comment_count),
    collectCount: toInteger(note.collected_count || note.collects || interactInfo.collected_count),
    shareCount: toInteger(note.share_count || note.shares || interactInfo.share_count),
    viewCount: toInteger(note.view_count || note.views || interactInfo.view_count),
    rawPayload: note as Prisma.InputJsonValue
  };
}

async function upsertCollection(prisma: ImportablePrisma, input: {
  name: string;
  sourceType: string;
  sourceQuery?: string | null;
  description?: string | null;
}) {
  const existing = await prisma.researchCollection.findFirst({
    where: {
      platform: ContentPlatform.XIAOHONGSHU,
      name: input.name
    }
  });

  if (existing) {
    return prisma.researchCollection.update({
      where: { id: existing.id },
      data: {
        sourceType: input.sourceType,
        sourceQuery: input.sourceQuery ?? null,
        description: input.description ?? null
      }
    });
  }

  return prisma.researchCollection.create({
    data: {
      platform: ContentPlatform.XIAOHONGSHU,
      name: input.name,
      sourceType: input.sourceType,
      sourceQuery: input.sourceQuery ?? null,
      description: input.description ?? null
    }
  });
}

async function upsertNote(prisma: ImportablePrisma, collectionId: string, note: NonNullable<ReturnType<typeof normalizeNote>>) {
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

export async function importXiaohongshuResearchPayload(prisma: ImportablePrisma, input: {
  payload: unknown;
  collectionName: string;
  sourceQuery?: string | null;
  description?: string | null;
  sourceType?: string;
}) {
  const rawNotes = normalizeArray(input.payload);
  const notes = rawNotes.map(normalizeNote).filter((item): item is NonNullable<ReturnType<typeof normalizeNote>> => Boolean(item));

  if (notes.length === 0) {
    throw new Error("No usable Xiaohongshu notes were found in the imported payload.");
  }

  const collection = await upsertCollection(prisma, {
    name: input.collectionName,
    sourceType: input.sourceType || "crawler-import",
    sourceQuery: input.sourceQuery,
    description: input.description
  });

  for (const note of notes) {
    await upsertNote(prisma, collection.id, note);
  }

  return {
    collection,
    notesImported: notes.length
  };
}
