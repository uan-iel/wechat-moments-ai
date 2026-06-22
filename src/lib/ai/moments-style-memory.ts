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

export function buildMomentsReferenceInstruction(referenceId?: string) {
  const option = MOMENTS_REFERENCE_OPTIONS.find((item) => item.id === referenceId) ?? MOMENTS_REFERENCE_OPTIONS[0];

  return [
    `本次参考倾向：${option.label}`,
    option.instruction
  ].join("\n");
}
