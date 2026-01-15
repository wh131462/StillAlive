import { motion } from 'framer-motion';
import { Github, Mail } from 'lucide-react';

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
          <h2 className="text-3xl sm:text-4xl font-bold mb-8">关于 StillAlive</h2>

          <div className="space-y-6 text-lg text-gray-400 leading-relaxed mb-10">
            <p>
              StillAlive 诞生于一个简单的想法：在这个忙碌的世界里，
              我们需要一种简单的方式来告诉在乎我们的人——我还好。
            </p>

            <p>
              无论你是独居青年、经常出差的商务人士、还是喜欢户外探险的冒险家，
              StillAlive 都能在你最需要的时候，替你发出那个重要的信号。
            </p>

            <p className="text-white">
              每一次打卡，都是对生活的一次确认。
              <br />
              记录不是为了回忆，而是为了证明我们真实地活过。
            </p>
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
