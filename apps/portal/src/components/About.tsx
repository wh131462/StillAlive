import { motion } from 'framer-motion';
import { Github, Mail, Heart } from 'lucide-react';

export default function About() {
  return (
    <section id="about" className="py-24 sm:py-32 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Heart className="w-10 h-10 text-primary" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold mb-8">关于「今天又活了一天」</h2>

          <div className="space-y-6 text-lg text-gray-400 leading-relaxed mb-10">
            <p>
              这是一款以"生存确认"和"记忆沉淀"为核心概念的打卡工具。
              它通过轻量化的每日互动，引导你记录生活中的意义，
              并为重要的人建立情感档案。
            </p>

            <p>
              我们相信，不是每一天都需要轰轰烈烈。
              有时候，仅仅是确认"今天又活了一天"，
              就是对生活最真实的记录。
            </p>

            <p className="text-white font-medium">
              活着本身，就是意义。
              <br />
              写下来的过程，就是加深记忆的过程。
            </p>
          </div>

          {/* Core Message */}
          <div className="bg-background rounded-2xl p-6 mb-10 border border-white/5">
            <p className="text-primary text-xl font-medium mb-2">"还活着吗？"</p>
            <p className="text-gray-400">每一天都值得被记录</p>
          </div>

          {/* Links */}
          <div className="flex justify-center gap-8">
            <a
              href="https://github.com/wh131462/StillAlive"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:text-primary-light transition-colors"
            >
              <Github size={20} />
              <span className="font-medium">GitHub</span>
            </a>

            <a
              href="mailto:contact@still-alive.me"
              className="flex items-center gap-2 text-primary hover:text-primary-light transition-colors"
            >
              <Mail size={20} />
              <span className="font-medium">联系我们</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
