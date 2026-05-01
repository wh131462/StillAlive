export const MILESTONE_DAYS = [7, 30, 100, 365, 1000] as const;

export type MilestoneDay = (typeof MILESTONE_DAYS)[number];

export const MILESTONE_MESSAGES: Record<MilestoneDay, string> = {
  7: '连续7天，你是真的在认真活着',
  30: '一个月了，生活在继续',
  100: '100天，你已经证明了自己',
  365: '一整年，这是属于你的史诗',
  1000: '1000天，你写下了自己的传记',
};

export function getNextMilestone(consecutiveDays: number): MilestoneDay | null {
  return MILESTONE_DAYS.find((d) => d > consecutiveDays) ?? null;
}

export function isMilestoneDay(consecutiveDays: number): boolean {
  return (MILESTONE_DAYS as readonly number[]).includes(consecutiveDays);
}

export function getMilestoneMessage(consecutiveDays: number): string | null {
  if (!isMilestoneDay(consecutiveDays)) return null;
  return MILESTONE_MESSAGES[consecutiveDays as MilestoneDay];
}
