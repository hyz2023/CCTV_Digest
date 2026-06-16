export interface PromptTerm { term: string; total: number; trajectory: { period: string; value: number }[] }
export interface ThreadPromptInput { terms: PromptTerm[]; recentThreadLabels: { label: string; count: number }[] }

export function buildThreadPrompt(input: ThreadPromptInput): string {
  const termsText = input.terms
    .map((t) => `  - ${t.term}（共${t.total}）: ${t.trajectory.map((p) => `${p.period}:${p.value}`).join(' ')}`)
    .join('\n');
  const labelsText = input.recentThreadLabels.map((l) => `${l.label}(${l.count})`).join('、') || '（无）';
  return [
    '你在梳理中国《新闻联播》多年的「发展主线（脉络）」。下面给你各「提法/关键词」的逐月强度轨迹，',
    '以及近期解读里出现过的主线标签。请把它们聚合成【客观存在】的几条主线。',
    '',
    '原则（重要）：',
    '- 主线的【数量由数据决定，不预设】；宁缺毋滥、不要为凑数而造主线。',
    '- 一条主线必须：由一组相关提法构成、且这些提法在多个月份里持续出现（跨时间持续性），而非昙花一现。',
    '',
    '输出一个 JSON 对象，字段名必须严格使用下列英文键（不要改名）：',
    '{ "threads": [ {',
    '   "name": 主线名（如「新质生产力·科技自立」）,',
    '   "status": 仅限 "active" / "merged" / "split" / "faded",',
    '   "memberTerms": 归属该主线的提法字符串数组（必须来自下方输入的词，至少 1 个）,',
    '   "read": 当下解读：这条主线眼下在表达什么',
    '} ] }',
    '注意：键名是 memberTerms 和 read，不要用 terms / description 等；每条主线的 memberTerms 不能为空。',
    '',
    '=== 提法逐月轨迹 ===',
    termsText,
    '=== 近期解读中的主线标签 ===',
    labelsText,
  ].join('\n');
}
