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
  getEncouragement as getEmotionEncouragement,
  getCareMessage as getEmotionCareMessage
} from './emotion'
// 伙伴系统
export {
  loadInteraction,
  updateInteraction,
  checkNeedCare,
  checkTopicRecall,
  getConsecutiveDays,
  detectPromise,
  addPromise,
  getUnfulfilledPromises,
  markPromiseReminded,
  getEncouragement,
  getCareMessage,
  getCasualReply,
  type InteractionRecord,
  type PromiseRecord
} from './companion'
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