import { motion } from 'framer-motion';
import { Feather, Sun, Heart, Brain } from 'lucide-react';

const values = [
  {
    icon: Feather,
    title: '轻量化',
    description: '不强求过度记录，支持"什么都不记录"的纯粹打卡。我们尊重每个人的节奏，打卡应该是轻松的，而不是负担。',
    color: 'primary',
  },
  {
    icon: Sun,
    title: '正向引导',
    description: '所有反馈文案采用温和、非压力式的表达。忘记打卡？"一定是因为昨天过得很开心吧"。我们只传递温暖。',
    color: 'amber',
  },
  {
    icon: Heart,
    title: '情感连接',
    description: '通过文字记录来对抗遗忘。重要的人不应该只存在于朋友圈，而是被郑重地记住、被用心地珍惜。',
    color: 'rose',
  },
  {
    icon: Brain,
    title: '记忆深化',
    description: '写下来的过程本身就是加深记忆的过程。每一次记录，都是在与自己的生活建立更深的连接。',
    color: 'blue',
  },
];

const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
  primary: { bg: 'bg-primary/5', text: 'text-primary', iconBg: 'bg-primary/10' },
  amber: { bg: 'bg-amber-500/5', text: 'text-amber-500', iconBg: 'bg-amber-500/10' },
  rose: { bg: 'bg-rose-500/5', text: 'text-rose-500', iconBg: 'bg-rose-500/10' },
  blue: { bg: 'bg-blue-500/5', text: 'text-blue-500', iconBg: 'bg-blue-500/10' },
};

export default function Values() {
  return (
    <section id="values" className="py-24 sm:py-32 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-background text-primary rounded-full text-sm font-medium mb-4 border border-white/10">
            产品理念
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            我们相信的事
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            不是每一天都需要轰轰烈烈，活着本身就是一种胜利。
          </p>
        </motion.div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {values.map((value, index) => {
            const colors = colorClasses[value.color];
            return (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-8 rounded-2xl bg-background border border-white/5 hover:border-white/10 transition-all duration-300"
              >
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-2xl ${colors.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <value.icon className={`w-7 h-7 ${colors.text}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{value.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
