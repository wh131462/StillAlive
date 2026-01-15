const footerLinks = {
  product: {
    title: '产品',
    links: [
      { label: '功能介绍', href: '#features' },
      { label: '下载应用', href: '#download' },
      { label: '网页版', href: 'https://app.still-alive.me' },
    ],
  },
  support: {
    title: '支持',
    links: [
      { label: '帮助中心', href: 'mailto:support@still-alive.me' },
      { label: '反馈建议', href: 'mailto:feedback@still-alive.me' },
    ],
  },
  legal: {
    title: '法律',
    links: [
      { label: '隐私政策', href: '/privacy' },
      { label: '服务条款', href: '/terms' },
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
              <span className="text-xl font-bold">StillAlive</span>
            </div>
            <p className="text-gray-500 text-sm">记录每一天，证明你还活着</p>
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
            &copy; {new Date().getFullYear()} StillAlive. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
