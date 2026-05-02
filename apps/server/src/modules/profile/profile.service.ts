import { prisma } from '../../lib/prisma';

export const profileService = {
  async getDeathConfirmation(userId: string) {
    return prisma.deathConfirmation.findUnique({ where: { userId } });
  },

  async upsertDeathConfirmation(userId: string, data: { triggerDays?: number; emergencyEmail?: string; enabled?: boolean }) {
    const existing = await prisma.deathConfirmation.findUnique({ where: { userId } });
    if (existing) {
      return prisma.deathConfirmation.update({
        where: { userId },
        data: {
          ...(data.triggerDays !== undefined && { triggerDays: data.triggerDays }),
          ...(data.emergencyEmail !== undefined && { emergencyEmail: data.emergencyEmail }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
        },
      });
    }
    return prisma.deathConfirmation.create({
      data: {
        userId,
        triggerDays: data.triggerDays ?? 7,
        emergencyEmail: data.emergencyEmail ?? '',
        enabled: data.enabled ?? false,
      },
    });
  },
};
