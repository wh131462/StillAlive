import { prisma } from '../../lib/prisma';
import { errors } from '../../lib/response';
import { todayString } from '@stillalive/core';

const PRESET_GROUPS = ['家人', '朋友', '同事', '其他'];

export const personService = {
  async ensurePresets(userId: string) {
    for (const name of PRESET_GROUPS) {
      await prisma.personGroup.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name, isPreset: true },
        update: {},
      });
    }
  },

  async list(userId: string, groupId?: string) {
    return prisma.person.findMany({
      where: { userId, ...(groupId && { groupId }) },
      orderBy: { createdAt: 'desc' },
    });
  },

  async detail(userId: string, id: string) {
    const person = await prisma.person.findFirst({ where: { id, userId }, include: { importantDates: true, sharedMemories: { orderBy: { createdAt: 'desc' } } } });
    if (!person) throw errors.notFound('人物不存在');
    return person;
  },

  async create(userId: string, data: { name: string; gender?: string; birthday?: string; birthdayLunar?: boolean; photoUrl?: string; mbti?: string; themeColor?: string; impression?: string; groupId?: string }) {
    await this.ensurePresets(userId);
    return prisma.person.create({
      data: { userId, ...data, themeColor: data.themeColor ?? '#C24D2C' },
    });
  },

  async update(userId: string, id: string, data: Record<string, unknown>) {
    const person = await prisma.person.findFirst({ where: { id, userId } });
    if (!person) throw errors.notFound('人物不存在');
    return prisma.person.update({ where: { id }, data });
  },

  async remove(userId: string, id: string) {
    const person = await prisma.person.findFirst({ where: { id, userId } });
    if (!person) throw errors.notFound('人物不存在');
    await prisma.person.delete({ where: { id } });
  },

  async groups(userId: string) {
    await this.ensurePresets(userId);
    return prisma.personGroup.findMany({ where: { userId }, include: { _count: { select: { persons: true } } } });
  },

  async createGroup(userId: string, name: string) {
    return prisma.personGroup.create({ data: { userId, name } });
  },

  async todayBirthdays(userId: string) {
    const today = todayString();
    const mmdd = today.slice(5);
    const all = await prisma.person.findMany({
      where: { userId, birthday: { not: null } },
    });
    return all.filter(p => p.birthday && p.birthday.slice(5) === mmdd);
  },

  async addImportantDate(userId: string, personId: string, data: { date: string; label: string; isLunar?: boolean }) {
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) throw errors.notFound('人物不存在');
    return prisma.importantDate.create({ data: { personId, ...data } });
  },

  async importantDates(userId: string, personId: string) {
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) throw errors.notFound('人物不存在');
    return prisma.importantDate.findMany({ where: { personId } });
  },

  async addMemory(userId: string, personId: string, data: { content: string; date?: string }) {
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) throw errors.notFound('人物不存在');
    return prisma.sharedMemory.create({ data: { personId, ...data } });
  },

  async memories(userId: string, personId: string) {
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) throw errors.notFound('人物不存在');
    return prisma.sharedMemory.findMany({ where: { personId }, orderBy: { createdAt: 'desc' } });
  },
};
