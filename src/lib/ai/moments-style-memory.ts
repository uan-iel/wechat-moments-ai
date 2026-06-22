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
      "可以使用“挖到宝了”“有点东西”“闭眼冲不亏”等同类语感，但不要照搬固定句子。",
      "结尾用轻促单表达，强调现在就能行动，但不要写成硬广。"
    ].join("\n")
  },
  {
    id: "daily-sharing",
    label: "日常分享",
    description: "适合产品背后的生活感、亲密关系、朋友互动和情绪共鸣。",
    instruction: [
      "更接近日常分享文案：先从一个具体生活场景或小情绪切入。",
      "少一点参数堆叠，多一点“我突然发现”“原来”“谁懂啊”式的体验感。",
      "要把产品自然放进关系、陪伴、松弛、快乐或仪式感里。",
      "结尾可以抛一个轻问题或留下余味。"
    ].join("\n")
  },
  {
    id: "promo-conversion",
    label: "活动转化",
    description: "适合 节点活动、补货、优惠、限时福利、库存提醒。",
    instruction: [
      "更接近活动转化文案：信息要清楚、节奏要快，福利点前置。",
      "可以使用活动时间、优惠、补货、库存有限、囤货刚需等强提醒结构。",
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
    description: "适合亲密关系、朋友、互动体验、情绪升温和关系共鸣。",
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
      "可以用“真的会玩出花”“越玩越上头”“很适合带去某个场合”这类体验感语气，但不要照抄。",
      "结尾适合轻种草和轻行动引导。"
    ].join("\n")
  },
  {
    id: "youth-healing",
    label: "青春治愈",
    description: "适合人生节点、成长、告别、夏天、青春回忆和轻疗愈内容。",
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
  "这是用户朋友圈的底层文风记忆，生成朋友圈时必须优先遵守。",
  "整体像熟人圈层里的真实分享和轻种草，不像品牌官号，不像正式广告稿。",
  "常用开头是强口语抓手：谁懂啊、救命、挖到宝了、别再乱买了、终于、突然发现、最近火到离谱。",
  "句子偏短，节奏快，喜欢用感叹号、破折号、括号式补充和少量 emoji 提升情绪，但不能密集堆砌。",
  "卖点不写成长段说明，而是拆成短句、清单或层层递进：颜值、便携、隐蔽、功能、场景、人群、价格、福利。",
  "表达里要有“人”的感受：爽到、戳我、松弛、后劲大、懒人狂喜、性价比拉满、稳稳拿捏。",
  "可以有轻微网感和亲密称呼，如用户、目标用户、目标用户、目标用户、新手，但要根据产品和目标克制使用。",
  "促销内容要直给，拒绝复杂套路，把优惠、补货、库存、囤货、今晚下单等信息放清楚。",
  "日常分享内容要从具体场景和情绪切入，产品或观点自然出现，不要一上来像销售。",
  "结尾通常是轻 CTA 或轻互动：闭眼冲、戳、扫码、今晚、你们呢、想试的可以看这里；不要过度逼单。"
].join("\n");

export const XIAOHONGSHU_STYLE_MEMORY = [
  "这是用户小红书内容的底层文风记忆，生成小红书时必须优先遵守。",
  "整体不是硬广，也不是流水账测评，而是“有情绪入口、有场景、有观点、再自然带出产品”的笔记写法。",
  "标题和开头要有抓力，常见方式是感叹、反问、结果先行、强场景先行，比如“终于找到”“原来真的会”“什么东西居然”“假期真的会玩出花”。",
  "正文常用短段落推进，喜欢先抛结论、再展开体验、故事、关系变化或情绪递进，让读者越看越代入。",
  "这类文案很重视人与人的关系感：亲密关系、朋友、心动对象、人生节点、假期、一起聊天、一起玩、一起告别，产品经常作为关系场景的触发器。",
  "除了种草，也会写轻观点和价值表达，尤其偏人群视角、共情力、关系价值、真实情绪和成长体验。",
  "语言口语化、有网感，但不是廉价热词堆砌；常用“谁懂”“真的”“没想到”“原来”“终于”“不要太适合”这类自然抓手。",
  "可以适度使用引号、问句、感叹号、emoji 和勾选符号增强节奏，但要克制，重点是让阅读顺滑。",
  "关键词要自然埋进场景和体验里，不要生硬罗列；卖点要通过体验结果、适合人群和使用情境带出来。",
  "结尾通常是轻互动、轻收藏、轻了解，不做强压迫转化；如果需要转化，也要像真实分享后的顺手提醒。"
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
