import { motion } from 'framer-motion';
import {
  Smartphone,
  Bell,
  Users,
  BarChart3,
  Globe,
  FileText,
} from 'lucide-react';

const features = [
  {
    icon: Smartphone,
    title: '一键打卡',
    description: '每天只需轻点一下，告诉世界你还在。支持添加今日心情和照片。',
  },
  {
    icon: Bell,
    title: '紧急联系人',
    description: '设置触发天数，当你长时间未打卡时，自动通知你指定的紧急联系人。',
  },
  {
    icon: Users,
    title: '珍视的人',
    description: '记录生命中重要的人，保存他们的信息，生日时收到温馨提醒。',
  },
  {
    icon: BarChart3,
    title: '数据统计',
    description: '查看打卡日历、连续天数、累计统计，见证你的坚持。',
  },
  {
    icon: Globe,
    title: '每日信息差',
    description: '每天 10 条精选新闻 + 历史上的今天，让你不错过世界的精彩。',
  },
  {
    icon: FileText,
    title: '年度总结',
    description: '年末生成专属年度报告，AI 帮你回顾这一年的点点滴滴。',
  },
];

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
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            为什么选择 StillAlive?
          </h2>
          <p className="text-gray-400 text-lg">
            简单而强大的功能，让记录变得有意义
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-8 rounded-2xl bg-surface border border-white/5 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
