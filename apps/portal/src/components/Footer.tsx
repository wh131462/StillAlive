// 获取 base URL，用于内部链接
const baseUrl = import.meta.env.BASE_URL || '/';
const designUrl = `${baseUrl}design/`.replace('//', '/');

const footerLinks = {
  product: {
    title: '产品',
    links: [
      { label: '功能特色', href: '#features' },
      { label: '产品理念', href: '#values' },
      { label: '下载应用', href: '#download' },
      { label: '网页版', href: 'https://app.still-alive.me' },
    ],
  },
  docs: {
    title: '文档',
    links: [
      { label: '设计原型', href: designUrl },
      { label: '产品需求', href: '#docs' },
      { label: 'GitHub', href: 'https://github.com/wh131462/StillAlive' },
    ],
  },
  support: {
    title: '支持',
    links: [
      { label: '帮助中心', href: 'mailto:support@still-alive.me' },
      { label: '反馈建议', href: 'mailto:feedback@still-alive.me' },
    ],
  },
};

export default function Footer() {
  return (
    <footer className="py-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">💚</span>
              <span className="text-xl font-bold">今天又活了一天</span>
            </div>
            <p className="text-gray-500 text-sm">生存确认 · 记忆沉淀</p>
            <p className="text-gray-600 text-xs mt-2">"还活着吗？" — 每一天都值得被记录</p>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-gray-300 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} 今天又活了一天 (StillAlive). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
