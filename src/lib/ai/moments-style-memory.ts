export const MOMENTS_REFERENCE_OPTIONS = [
  {
    id: "auto",
    label: "自动贴合",
    description: "根据内容形式、产品和目标自动选择表达角度。",
    instruction: "自动判断最合适的表达角度，不要机械套用单一模板。"
  },
  {
    id: "product-seeding",
    label: "产品种草",
    description: "适合新品、单品卖点、性价比和购买转化。",
    instruction: [
      "更接近产品种草文案：开头要有发现感或强利益点。",
      "正文用短句拆卖点，突出价格、颜值、便携、功能、适合人群、使用场景。",
      "可以使用自然口语化的发现感表达，但不要照搬固定句子。",
      "结尾用轻促单表达，强调现在就能行动，但不要写成硬广。"
    ].join("\n")
  },
  {
    id: "daily-sharing",
    label: "日常分享",
    description: "适合产品背后的生活感、亲密关系、朋友互动和情绪共鸣。",
    instruction: [
      "更接近日常分享文案：先从一个具体生活场景或小情绪切入。",
      "少一点参数堆叠，多一点第一人称体验、即时感受和真实转折。",
      "要把产品自然放进关系、陪伴、松弛、快乐或仪式感里。",
      "结尾可以抛一个轻问题或留下余味。"
    ].join("\n")
  },
  {
    id: "promo-conversion",
    label: "活动转化",
    description: "适合节点活动、补货、优惠、限时福利、库存提醒。",
    instruction: [
      "更接近活动转化文案：信息要清楚、节奏要快，福利点前置。",
      "可以使用活动时间、优惠机制、补货、库存有限、当下需求等强提醒结构。",
      "不要复杂解释规则，优先让读者一眼知道现在买什么、为什么现在买。",
      "结尾用明确但不压迫的行动引导。"
    ].join("\n")
  },
  {
    id: "soft-opinion",
    label: "观点随笔",
    description: "适合电影、文章、价值观表达或轻内容引流。",
    instruction: [
      "更接近轻观点/随笔：少卖货，多表达一个真实感受或观察。",
      "可以用电影、雨天、被删文章、青春、亲密关系等生活化切口承载观点。",
      "语言要有一点自嘲和松弛感，不要像公众号摘要。",
      "结尾适合开放式提问或温柔收住。"
    ].join("\n")
  }
] as const;

export type MomentsReferenceId = (typeof MOMENTS_REFERENCE_OPTIONS)[number]["id"];

export const XIAOHONGSHU_REFERENCE_OPTIONS = [
  {
    id: "auto",
    label: "自动贴合",
    description: "根据内容形式、产品和目标自动选择最合适的小红书表达路径。",
    instruction: "自动判断最合适的小红书表达角度，不要机械套用单一路数。"
  },
  {
    id: "relationship-story",
    label: "关系故事",
    description: "适合亲密关系、朋友互动、体验分享、情绪升温和关系共鸣。",
    instruction: [
      "更接近关系故事型笔记：从人与人之间的互动、心动、陪伴或深入聊天切入。",
      "不要先堆产品参数，而是先让读者感受到一种关系气氛，再自然带出产品。",
      "句子可以短促、带一点心动感和画面感，像在分享一个真实发生的小片段。",
      "结尾适合轻轻收住，留下代入感或互动欲。"
    ].join("\n")
  },
  {
    id: "value-editorial",
    label: "观点表达",
    description: "适合人群视角、关系价值、品牌理念、情绪观察和轻观点内容。",
    instruction: [
      "更接近观点表达型笔记：不是单纯种草，而是先说一个真实观察、价值判断或情绪洞察。",
      "可以有“我们为什么想做这件事”“我们更在意什么”这类编辑感表达。",
      "语言要细腻、有主张，但不能像长文说教，要保持社交平台的可读性和温度。",
      "产品只作为观点的承接物，不要把笔记写成参数说明书。"
    ].join("\n")
  },
  {
    id: "scene-seeding",
    label: "场景种草",
    description: "适合新品种草、礼物推荐、假期场景、聚会玩法和具体使用情境。",
    instruction: [
      "更接近场景种草型笔记：开头就给读者一个清晰可代入的场景或结果感。",
      "正文要兼顾好玩、好用、适合谁、适合什么时候，不要只列卖点。",
      "可以使用体验递进和场景结果感语气，但不要照抄参考表达。",
      "结尾适合轻种草和轻行动引导。"
    ].join("\n")
  },
  {
    id: "youth-healing",
    label: "青春治愈",
    description: "适合人生节点、成长、告别、季节氛围、回忆和轻疗愈内容。",
    instruction: [
      "更接近青春治愈型笔记：从时间节点、天气、夏天、某个场景或一句话切入。",
      "重视节奏留白，让文案有一点散文感，但仍然要清楚、好读。",
      "适合把产品放进成长、告别、纪念、陪伴这类情绪语境中。",
      "结尾要温柔，不要强推购买。"
    ].join("\n")
  }
] as const;

export type XiaohongshuReferenceId = (typeof XIAOHONGSHU_REFERENCE_OPTIONS)[number]["id"];

export const MOMENTS_STYLE_MEMORY = [
  "这是通用朋友圈兜底文风记忆。若当前项目配置了专属记忆，必须优先使用项目记忆。",
  "整体像真实分享和轻种草，不像正式广告稿。",
  "开头要有明确场景、发现感、利益点或情绪入口。",
  "句子偏短，节奏清楚，卖点通过场景和体验自然带出。",
  "结尾使用温和行动或轻互动，不要过度逼单。"
].join("\n");

export const XIAOHONGSHU_STYLE_MEMORY = [
  "这是通用小红书兜底文风记忆。若当前项目配置了专属记忆，必须优先使用项目记忆。",
  "整体不是硬广，也不是流水账测评，而是有标题抓力、场景入口和自然转化的笔记写法。",
  "标题和开头要有结果感、场景感或轻悬念。",
  "正文用短段落推进，先给代入，再展开体验、信息和使用情境。",
  "关键词要自然埋进内容里，卖点通过体验结果和适合人群带出来。",
  "结尾通常是轻互动、轻收藏、轻了解，不做强压迫转化。"
].join("\n");

export function buildMomentsReferenceInstruction(referenceId?: string) {
  const option = MOMENTS_REFERENCE_OPTIONS.find((item) => item.id === referenceId) ?? MOMENTS_REFERENCE_OPTIONS[0];

  return [
    `本次参考倾向：${option.label}`,
    option.instruction
  ].join("\n");
}

export function buildXiaohongshuReferenceInstruction(referenceId?: string) {
  const option = XIAOHONGSHU_REFERENCE_OPTIONS.find((item) => item.id === referenceId) ?? XIAOHONGSHU_REFERENCE_OPTIONS[0];

  return [
    `本次参考倾向：${option.label}`,
    option.instruction
  ].join("\n");
}

export function getPlatformStyleMemory(platform?: "MOMENTS" | "XIAOHONGSHU") {
  return platform === "XIAOHONGSHU" ? XIAOHONGSHU_STYLE_MEMORY : MOMENTS_STYLE_MEMORY;
}

export function buildPlatformReferenceInstruction(platform?: "MOMENTS" | "XIAOHONGSHU", referenceId?: string) {
  return platform === "XIAOHONGSHU"
    ? buildXiaohongshuReferenceInstruction(referenceId)
    : buildMomentsReferenceInstruction(referenceId);
}
