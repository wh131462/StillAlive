import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

const platforms = [
  {
    name: 'Android',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
        <path d="M17.523 15.341c-.5 0-.875-.188-1.188-.563-.312-.375-.437-.875-.437-1.5s.125-1.125.437-1.5c.313-.375.688-.562 1.188-.562.5 0 .875.187 1.188.562.312.375.437.875.437 1.5s-.125 1.125-.437 1.5c-.313.375-.688.563-1.188.563zm-11.046 0c-.5 0-.875-.188-1.188-.563-.312-.375-.437-.875-.437-1.5s.125-1.125.437-1.5c.313-.375.688-.562 1.188-.562.5 0 .875.187 1.188.562.312.375.437.875.437 1.5s-.125 1.125-.437 1.5c-.313.375-.688.563-1.188.563zM18.4 8.134l1.563-2.688c.062-.125.062-.25-.063-.312-.125-.063-.25-.063-.312.062l-1.625 2.75c-1.25-.562-2.688-.875-4.188-.875s-2.938.313-4.188.875L7.962 5.196c-.062-.125-.187-.125-.312-.062-.125.062-.125.187-.063.312l1.563 2.688C6.275 9.509 4.4 12.072 4.4 15.072h15.2c0-3-1.875-5.563-4.75-6.938z" />
      </svg>
    ),
    description: 'Android 8.0 及以上',
    action: { label: '下载 APK', href: '/downloads/stillalive.apk' },
    version: 'v1.0.0 · 15MB',
    available: true,
  },
  {
    name: 'iOS',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    description: 'iOS 14.0 及以上',
    action: { label: '即将上线', href: '#' },
    version: '敬请期待',
    available: false,
  },
  {
    name: '网页版',
    icon: Globe,
    description: '任意现代浏览器',
    action: { label: '立即使用', href: 'https://app.still-alive.me' },
    version: '无需下载',
    available: true,
  },
];

export default function Download() {
  return (
    <section id="download" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">立即下载</h2>
          <p className="text-gray-400 text-lg">选择适合你的平台</p>
        </motion.div>

        {/* Download Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {platforms.map((platform, index) => (
            <motion.div
              key={platform.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-surface rounded-2xl p-8 text-center border border-white/5 hover:border-primary/50 transition-all"
            >
              <div className="text-primary mb-5 flex justify-center">
                <platform.icon />
              </div>

              <h3 className="text-2xl font-semibold mb-2">{platform.name}</h3>
              <p className="text-gray-400 mb-6">{platform.description}</p>

              <a
                href={platform.action.href}
                className={`block w-full py-3 rounded-xl font-semibold transition-all ${
                  platform.available
                    ? 'bg-primary hover:bg-primary-dark text-white'
                    : 'bg-surface-light text-gray-500 cursor-not-allowed'
                }`}
              >
                {platform.action.label}
              </a>

              <p className="text-sm text-gray-500 mt-4">{platform.version}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
