export interface InterpItem { ord: number; segment: string; title: string; summary: string }
export interface InterpRadar { type: string; target: string; magnitude: number }
export interface InterpInput { date: string; items: InterpItem[]; radar: InterpRadar[] }

export function buildInterpretationPrompt(input: InterpInput): string {
  const itemsText = input.items
    .map((it) => `  [${it.ord}] (${it.segment}) ${it.title} — ${it.summary}`)
    .join('\n');
  const radarText = input.radar.length
    ? input.radar.map((r) => `  - ${r.type}: ${r.target} (强度 ${r.magnitude})`).join('\n')
    : '  （今日无显著雷达变化）';
  return [
    `你是中国《新闻联播》的投研解读助手。把 ${input.date} 这期联播读作「信号」，而非复述事实。`,
    '联播是被精心编排的宣传：编辑选择（上场顺序、时长、措辞、连续敲鼓）本身就是信息。',
    '',
    '请给出当日【最多 3 个】最重要的信号。每个信号按三层展开：',
    '1) 政策主题层 theme：它指向什么政策方向、为什么是现在；',
    '2) 行业层 sectors：可能受影响的行业/板块及方向（bull/bear/neutral）；',
    '3) 标的层 tickers：示例标的——仅为线索、非投资建议，宁缺毋滥，可留空。',
    '并给出 confidence（high/mid/low），标注该信号是否由今日雷达变化驱动（fromRadar），',
    '以及它所属的主线 thread（自由命名，后续会归一）。',
    '',
    '认知谦逊：联播反映的是「意图/姿态」，不等于现实，也不一定等于已落地的政策；',
    '单日口径变化≠政策落地。请谨慎、不臆造，把握不准就降低 confidence。',
    '',
    `=== 今日条目（共 ${input.items.length} 条）===`,
    itemsText,
    '=== 今日雷达（相对基线的变化）===',
    radarText,
  ].join('\n');
}
