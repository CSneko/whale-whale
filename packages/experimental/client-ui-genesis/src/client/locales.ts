/** Typed English and Chinese copy owned by the Genesis settings view. @module */
export const en = {
  title: 'Genesis', refresh: 'Refresh', active: 'Running', unavailable: 'Genesis is unavailable. Enable the plugin and retry.',
  failed: 'Could not refresh Genesis. The previous sample may be outdated. Check the Host logs and retry.',
  name: 'Name', unnamed: 'Not yet named', lifeId: 'Life ID', born: 'Created', version: 'Life Core version',
  sampled: 'Last refreshed', sessions: 'Live Sessions', memories: 'Long-term memories', events: 'Life events', growth: 'System growth',
  capabilities: 'Capabilities in live Sessions', noCapabilities: 'No tools are currently visible to a live Session.',
  permission: 'Tool visibility does not grant permission. Authorization is checked for each execution.',
  unverified: 'Not yet tested', succeeded: 'Successful use recorded', toolFailed: 'Last use failed',
  emptyMemories: 'No memory previews fit this sample.', emptyGrowth: 'No growth previews fit this sample.',
  candidate: 'Candidate memory', source: 'Source events', omitted: '{count} additional records are not shown.',
  limitations: 'Emotion, motivation, autonomous awakening and self-improvement are not implemented. This system does not establish subjective consciousness.',
  'category.episodic': 'Experience', 'category.semantic': 'Knowledge', 'category.self': 'Self', 'category.procedural': 'Procedure',
} as const
/** Locale key set; both dictionaries must describe the same user-visible states. */
export type GenesisKey = keyof typeof en
/** Simplified Chinese counterpart of the English dictionary. */
export const zh: Record<GenesisKey, string> = {
  title: 'Genesis', refresh: '刷新', active: '运行中', unavailable: 'Genesis 当前不可用，请启用插件后重试',
  failed: '无法刷新 Genesis，之前的状态可能已过时。请检查主机日志后重试',
  name: '名称', unnamed: '尚未命名', lifeId: '生命 ID', born: '诞生时间', version: '生命核心版本',
  sampled: '上次刷新', sessions: '运行中的会话', memories: '长期记忆', events: '生命事件', growth: '系统成长',
  capabilities: '运行中会话的能力', noCapabilities: '当前没有向运行中会话开放的工具',
  permission: '工具可见不代表已获授权，每次执行仍须通过权限检查',
  unverified: '尚未验证', succeeded: '有成功使用记录', toolFailed: '最近一次使用失败',
  emptyMemories: '本次状态中没有可展示的记忆', emptyGrowth: '本次状态中没有可展示的成长记录',
  candidate: '候选记忆', source: '来源事件', omitted: '另有 {count} 条记录未展示',
  limitations: '情绪、动机、自主唤醒和自我完善尚未实现。本系统不代表已建立主观意识',
  'category.episodic': '经历', 'category.semantic': '知识', 'category.self': '自我', 'category.procedural': '程序性知识',
}
