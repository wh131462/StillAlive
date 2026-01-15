import { motion } from 'framer-motion';
import { Download, ArrowRight } from 'lucide-react';

const stats = [
  { value: '10,000+', label: '活跃用户' },
  { value: '1M+', label: '打卡次数' },
  { value: '99.9%', label: '在线率' },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-violet-500/15 rounded-full blur-[128px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              每一天，
              <br />
              <span className="gradient-text">活着</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 mb-8 leading-relaxed">
              简单的每日打卡，记录你的存在。
              <br />
              当你沉默太久，我们会替你呼唤重要的人。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <a
                href="#download"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary hover:bg-primary-dark rounded-xl text-white font-semibold text-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/25"
              >
                <Download size={20} />
                立即下载
              </a>
              <a
                href="https://app.still-alive.me"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-surface hover:bg-surface-light rounded-xl text-white font-semibold text-lg transition-all border border-white/10"
              >
                网页版
                <ArrowRight size={20} />
              </a>
            </div>

            {/* Stats */}
            <div className="flex justify-center lg:justify-start gap-8 sm:gap-12">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-2xl sm:text-3xl font-bold text-primary">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right - Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 via-cyan-400/30 to-violet-500/30 rounded-[3rem] blur-2xl opacity-50" />

              {/* Phone Frame */}
              <div className="relative w-[280px] sm:w-[320px] bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                <div className="bg-surface rounded-[2rem] overflow-hidden">
                  {/* App Screen */}
                  <div className="p-6">
                    {/* Header */}
                    <div className="mb-6">
                      <div className="text-2xl font-bold">早上好</div>
                      <div className="text-gray-500 text-sm">2024年12月15日</div>
                    </div>

                    {/* Checkin Card */}
                    <div className="bg-primary rounded-2xl p-6 text-center mb-6">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-primary text-2xl">✓</span>
                      </div>
                      <div className="text-lg font-semibold mb-1">今日已打卡</div>
                      <div className="text-white/80 text-sm">🔥 连续 42 天</div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: '365', label: '累计' },
                        { value: '42', label: '连续' },
                        { value: '12', label: '珍视的人' },
                      ].map((item) => (
                        <div key={item.label} className="text-center">
                          <div className="text-xl font-bold text-primary">
                            {item.value}
                          </div>
                          <div className="text-xs text-gray-500">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
