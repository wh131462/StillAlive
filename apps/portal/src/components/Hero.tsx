import { motion } from 'framer-motion';
import { Download, ArrowRight, Heart } from 'lucide-react';

const stats = [
  { value: '10K+', label: '活跃用户' },
  { value: '500K+', label: '打卡记录' },
  { value: '4.9', label: '用户评分' },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-[128px]" />
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
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface rounded-full border border-white/10 mb-6"
            >
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-sm text-gray-300">生存确认 · 记忆沉淀</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              还活着吗？
              <br />
              <span className="gradient-text">今天又活了一天</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 mb-8 leading-relaxed max-w-xl">
              一款以"生存确认"和"记忆沉淀"为核心的打卡工具。
              <br />
              通过轻量化的每日互动，引导你记录生活中的意义，为重要的人建立情感档案。
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
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 via-emerald-400/30 to-teal-500/30 rounded-[3rem] blur-2xl opacity-50" />

              {/* Phone Frame */}
              <div className="relative w-[280px] sm:w-[320px] bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                <div className="bg-surface rounded-[2rem] overflow-hidden">
                  {/* App Screen */}
                  <div className="p-5">
                    {/* Status Card */}
                    <div className="bg-background rounded-2xl p-5 text-center mb-4 border border-white/5">
                      <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Heart className="w-8 h-8 text-rose-500 animate-pulse" />
                      </div>
                      <div className="text-lg font-semibold mb-1">还活着吗？</div>
                      <div className="text-gray-500 text-sm">今日尚未确认存活</div>
                    </div>

                    {/* Checkin Button */}
                    <div className="flex justify-center mb-4">
                      <div className="w-20 h-20 gradient-bg rounded-full flex flex-col items-center justify-center text-white shadow-lg shadow-primary/30">
                        <span className="text-xl mb-0.5">✓</span>
                        <span className="text-xs">确认存活</span>
                      </div>
                    </div>

                    {/* Birthday Reminder */}
                    <div className="bg-amber-500/10 rounded-xl p-3 mb-4 flex items-center border border-amber-500/20">
                      <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center mr-2">
                        <span className="text-sm">🎂</span>
                      </div>
                      <div className="flex-grow">
                        <div className="text-amber-400 text-xs font-medium">今日生日提醒</div>
                        <div className="text-amber-300/70 text-xs">张三 今天生日</div>
                      </div>
                    </div>

                    {/* Daily Info */}
                    <div className="gradient-bg rounded-xl p-4 text-white">
                      <div className="text-white/70 text-xs mb-1">每日信息差</div>
                      <div className="text-sm font-medium">维基百科于2001年的今天正式上线</div>
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
