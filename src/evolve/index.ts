// 自进化系统入口
export { learnFromText, loadPreferences, getPreferencePrompt } from './preferences'
export { addFeedback, getFeedbackStats } from './feedback'
export { addEvent, formatHistory, getGrowthScore } from './history'
// 新一代进化系统
export {
  loadEvolutionState,
  addXp,
  recordPattern,
  recordFailedPattern,
  updatePersonality,
  getEvolutionPrompt,
  getEvolutionSummary,
  type EvolutionState,
  type Skill
} from './evolution'