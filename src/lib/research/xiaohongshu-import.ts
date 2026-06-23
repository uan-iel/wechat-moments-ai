import { ContentPlatform, Prisma, PrismaClient } from "@prisma/client";

type ImportablePrisma = PrismaClient;

function tokenize(value: string) {
  const normalized = cleanString(value).toLowerCase();
  const asciiTokens: string[] = normalized.match(/[a-z0-9]+/g) ?? [];
  const cjkTokens: string[] = normalized.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const cjkBigrams = cjkTokens.flatMap((token) => {
    if (token.length <= 2) {
      return [token];
    }

    return Array.from({ length: token.length - 1 }, (_, index) => token.slice(index, index + 2));
  });

  return Array.from(new Set([...asciiTokens, ...cjkTokens, ...cjkBigrams].map((token) => token.trim()).filter(Boolean)));
}

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

function rawNoteSourceKeyword(note: Record<string, unknown>) {
  return cleanString(note.source_keyword || note.sourceKeyword || note.keyword || note.query);
}

function rawNoteMatchesSourceQuery(note: Record<string, unknown>, sourceQuery?: string | null) {
  const query = cleanString(sourceQuery || "");

  if (!query) {
    return true;
  }

  const sourceKeyword = rawNoteSourceKeyword(note);

  if (!sourceKeyword) {
    return null;
  }

  return sourceKeyword.toLowerCase() === query.toLowerCase();
}

function noteMatchesQuery(
  note: NonNullable<ReturnType<typeof normalizeNote>>,
  sourceQuery?: string | null
) {
  const query = cleanString(sourceQuery || "");

  if (!query) {
    return true;
  }

  const referenceTokens = tokenize(query);

  if (referenceTokens.length === 0) {
    return true;
  }

  const candidateText = [note.title, note.content, note.keywords.join(" "), note.authorName]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  if (candidateText.includes(query.toLowerCase())) {
    return true;
  }

  const overlapCount = referenceTokens.reduce(
    (count, token) => count + (candidateText.includes(token) ? 1 : 0),
    0
  );
  const minimumOverlap = referenceTokens.length >= 2 ? 2 : 1;

  return overlapCount >= minimumOverlap;
}

async function upsertCollection(prisma: ImportablePrisma, input: {
  projectId: string;
  name: string;
  sourceType: string;
  sourceQuery?: string | null;
  description?: string | null;
}) {
  const existing = await prisma.researchCollection.findFirst({
    where: {
      projectId: input.projectId,
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
      projectId: input.projectId,
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
  projectId: string;
  payload: unknown;
  collectionName: string;
  sourceQuery?: string | null;
  description?: string | null;
  sourceType?: string;
}) {
  const rawNotes = normalizeArray(input.payload);
  const rawSourceMatches = rawNotes.filter((note) => rawNoteMatchesSourceQuery(note, input.sourceQuery) === true);
  const hasSourceKeyword = rawNotes.some((note) => rawNoteMatchesSourceQuery(note, input.sourceQuery) !== null);
  const scopedRawNotes = hasSourceKeyword ? rawSourceMatches : rawNotes;
  const normalizedNotes = rawNotes
    .map(normalizeNote)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeNote>> => Boolean(item));
  const sourceScopedNotes = scopedRawNotes
    .map(normalizeNote)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeNote>> => Boolean(item));
  const notes = sourceScopedNotes.filter((note) => noteMatchesQuery(note, input.sourceQuery));

  const usableNotes = input.sourceQuery ? (hasSourceKeyword ? sourceScopedNotes : notes) : normalizedNotes;

  if (usableNotes.length === 0) {
    throw new Error(
      input.sourceQuery
        ? `没有找到与“${input.sourceQuery}”匹配的小红书抓取结果。请重新抓取，或换一个更贴近小红书搜索结果的关键词。`
        : "No usable Xiaohongshu notes were found in the imported payload."
    );
  }

  const collection = await upsertCollection(prisma, {
    projectId: input.projectId,
    name: input.collectionName,
    sourceType: input.sourceType || "crawler-import",
    sourceQuery: input.sourceQuery,
    description: input.description
  });

  await prisma.researchInsight.deleteMany({
    where: {
      collectionId: collection.id
    }
  });

  await prisma.researchNote.deleteMany({
    where: {
      collectionId: collection.id
    }
  });

  for (const note of usableNotes) {
    await upsertNote(prisma, collection.id, note);
  }

  return {
    collection,
    notesImported: usableNotes.length
  };
}
