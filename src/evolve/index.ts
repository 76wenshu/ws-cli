// 自进化系统入口
export { learnFromText, loadPreferences, getPreferencePrompt } from './preferences'
export { addFeedback, getFeedbackStats } from './feedback'
export { addEvent, formatHistory, getGrowthScore } from './history'
// 用户画像
export {
  loadProfile,
  saveProfile,
  updateProfile,
  getProfile,
  getProfilePrompt,
  learnProfileFromText,
  isProfileComplete,
  type UserProfile
} from './profile'
// 提醒系统
export {
  loadReminders,
  addReminder,
  completeReminder,
  deleteReminder,
  getPendingReminders,
  getUpcomingReminders,
  parseTimeString,
  formatReminderTime,
  type Reminder
} from './reminder'
// 情绪感知
export {
  detectEmotion,
  getWarmResponse,
  getEncouragement,
  getCareMessage
} from './emotion'
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