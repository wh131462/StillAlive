import { motion } from 'framer-motion';
import { FileText, Palette, Server, Rocket, Layout, Database } from 'lucide-react';

// 获取 base URL，用于内部链接
const baseUrl = import.meta.env.BASE_URL || '/';
const designUrl = `${baseUrl}design/`.replace('//', '/');

const docs = [
  {
    icon: Layout,
    title: '设计原型',
    description: '交互原型、页面设计、UI 组件预览',
    href: designUrl,
    file: '在线预览',
    isInternal: true,
  },
  {
    icon: FileText,
    title: '产品需求文档',
    description: '详细的功能规划、用户故事和产品愿景',
    href: 'https://github.com/wh131462/StillAlive/blob/master/docs/PRD.md',
    file: 'PRD.md',
  },
  {
    icon: Palette,
    title: '设计规范',
    description: '视觉规范、交互设计、组件样式指南',
    href: 'https://github.com/wh131462/StillAlive/blob/master/docs/DESIGN_SPEC.md',
    file: 'DESIGN_SPEC.md',
  },
  {
    icon: Database,
    title: '技术架构',
    description: '整体架构设计、数据模型、技术选型',
    href: 'https://github.com/wh131462/StillAlive/blob/master/docs/ARCHITECTURE.md',
    file: 'ARCHITECTURE.md',
  },
  {
    icon: Server,
    title: '后端文档',
    description: 'API 设计、数据接口、增值服务方案',
    href: 'https://github.com/wh131462/StillAlive/blob/master/docs/BACKEND.md',
    file: 'BACKEND.md',
  },
  {
    icon: Rocket,
    title: '部署指南',
    description: 'Docker 部署、Nginx 配置、SSL 证书设置',
    href: 'https://github.com/wh131462/StillAlive/blob/master/docs/DEPLOYMENT.md',
    file: 'DEPLOYMENT.md',
  },
];

export default function Docs() {
  return (
    <section id="docs" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            开发文档
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">深入了解项目</h2>
          <p className="text-gray-400 text-lg">
            完整的设计规范与技术文档
          </p>
        </motion.div>

        {/* Featured - Design Prototype */}
        <motion.a
          href={designUrl}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="group block p-8 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 border border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 mb-8 max-w-4xl mx-auto"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/30 transition-colors">
              <Layout className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                设计原型预览
              </h3>
              <p className="text-gray-400">
                查看完整的 UI 设计稿、交互原型和页面流程，包含主页、打卡、人物、我的四大模块
              </p>
            </div>
            <div className="hidden sm:block text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </motion.a>

        {/* Docs Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {docs.slice(1).map((doc, index) => (
            <motion.a
              key={doc.title}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-6 rounded-2xl bg-surface border border-white/5 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <doc.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  {doc.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-3 flex-grow">
                  {doc.description}
                </p>
                <span className="text-xs text-gray-500 font-mono">
                  {doc.file}
                </span>
              </div>
            </motion.a>
          ))}
        </div>

        {/* GitHub Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <a
            href="https://github.com/wh131462/StillAlive"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>在 GitHub 上查看完整源码</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
