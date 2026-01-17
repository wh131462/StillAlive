import { motion } from 'framer-motion';
import {
  Heart,
  PenLine,
  Users,
  Calendar,
  Cake,
  AlertTriangle,
} from 'lucide-react';

const features = [
  {
    icon: Heart,
    title: '生存确认',
    description: '一键确认存活，不强求过度记录。支持"什么都不记录"的纯粹打卡，活着本身就是意义。',
    color: 'rose',
  },
  {
    icon: PenLine,
    title: '意义记录',
    description: '记录今天有意义的事，写下来的过程本身就是加深记忆的过程，对抗遗忘的最好方式。',
    color: 'amber',
  },
  {
    icon: Users,
    title: '人物小传',
    description: '为重要的人建立情感档案，记录共同经历与个人印象，将重要的人内化为持久的记忆。',
    color: 'blue',
  },
  {
    icon: Calendar,
    title: '打卡日历',
    description: '日历视图直观展示打卡情况，支持补签功能。连续打卡达成里程碑时，收获温暖的鼓励。',
    color: 'violet',
  },
  {
    icon: Cake,
    title: '生日提醒',
    description: '重要的人生日当天温馨提醒，不会提前打扰。让你在重要时刻送上真挚祝福。',
    color: 'pink',
  },
  {
    icon: AlertTriangle,
    title: '死亡确认',
    description: '连续多日未打卡时，可选择发送确认邮件给紧急联系人。这是一份独特的安全感。',
    color: 'slate',
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'hover:border-rose-500/50' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'hover:border-amber-500/50' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'hover:border-blue-500/50' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'hover:border-violet-500/50' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-500', border: 'hover:border-pink-500/50' },
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'hover:border-slate-500/50' },
};

export default function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            功能特色
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            简单，却不简陋
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            我们相信，最好的工具是让你专注于真正重要的事情。轻量化设计，零压力记录。
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const colors = colorClasses[feature.color];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`group p-8 rounded-2xl bg-surface border border-white/5 ${colors.border} transition-all duration-300 hover:shadow-xl hover:shadow-primary/5`}
              >
                <div className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-7 h-7 ${colors.text}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
