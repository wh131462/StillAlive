import { motion } from 'framer-motion';

const milestones = [
  {
    days: 7,
    message: '连续7天，你是真的在认真活着',
  },
  {
    days: 30,
    message: '一个月了，生活在继续',
  },
  {
    days: 100,
    message: '100天，你已经证明了自己',
  },
  {
    days: 365,
    message: '一整年，这是属于你的史诗',
  },
];

export default function Milestones() {
  return (
    <section className="py-24 sm:py-32 bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[128px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-surface text-primary rounded-full text-sm font-medium mb-4 border border-white/10">
            温暖文案
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            每个里程碑，都值得被温柔对待
          </h2>
        </motion.div>

        {/* Milestones Grid */}
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          {milestones.map((milestone, index) => (
            <motion.div
              key={milestone.days}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-6 rounded-2xl bg-surface/50 border border-white/5 hover:border-primary/30 transition-all duration-300 text-center"
            >
              <div className="w-14 h-14 gradient-bg rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-white text-lg shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform">
                {milestone.days}
              </div>
              <p className="text-lg text-gray-300 leading-relaxed">"{milestone.message}"</p>
            </motion.div>
          ))}
        </div>

        {/* Special Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto"
        >
          <div className="p-6 rounded-2xl bg-surface/50 border border-white/5 text-center">
            <p className="text-gray-500 text-sm mb-2">忘记打卡时...</p>
            <p className="text-lg text-gray-300 italic">
              "一定是因为昨天过得很开心吧，才忘了打卡"
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
