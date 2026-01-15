import { motion } from 'framer-motion';
import { UserPlus, CalendarCheck, Mail, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    title: '设置联系人',
    description: '添加一位信任的人的邮箱，设置触发天数（如 7 天）',
  },
  {
    icon: CalendarCheck,
    title: '每日打卡',
    description: '每天打开 App 点一下，只需 1 秒钟',
  },
  {
    icon: Mail,
    title: '自动通知',
    description: '如果连续 7 天未打卡，系统自动发邮件给紧急联系人',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 sm:py-32 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            紧急联系人如何工作?
          </h2>
          <p className="text-gray-400 text-lg">一个简单但可能救命的功能</p>
        </motion.div>

        {/* Steps */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-4 mb-16">
          {steps.map((step, index) => (
            <div key={step.title} className="flex items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="flex flex-col items-center text-center max-w-[280px]"
              >
                {/* Step Number */}
                <div className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center mb-6 shadow-lg shadow-primary/25">
                  <step.icon className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400">{step.description}</p>
              </motion.div>

              {/* Arrow */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block mx-8">
                  <ArrowRight className="w-8 h-8 text-primary" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-background rounded-2xl p-6 text-center">
            <p className="text-gray-400">
              <span className="text-xl mr-2">💡</span>
              <span className="font-semibold text-white">适用场景：</span>
              独居人士、出差旅行、户外探险、或者只是想让家人安心
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
