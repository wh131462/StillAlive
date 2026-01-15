import { useState } from 'react';

export default function Home() {
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const handleCheckIn = () => {
    setIsCheckedIn(true);
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm text-center border border-slate-100">
        <div className="mb-4">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-3xl animate-heartbeat">💓</span>
          </div>
          <p className="text-slate-500 text-sm">
            {isCheckedIn ? '生存状态：已确认' : '生存状态：确认中...'}
          </p>
        </div>
        <button
          onClick={handleCheckIn}
          disabled={isCheckedIn}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${isCheckedIn
              ? 'bg-emerald-500 text-white cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
        >
          {isCheckedIn ? '已确认存活 ✓' : '确认存活打卡'}
        </button>
        <p className="text-slate-400 text-xs mt-3 italic">"还活着吗？"</p>
      </div>

      {/* Success Feedback */}
      {isCheckedIn && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
          <p className="text-emerald-700 font-bold text-lg mb-1">🎉 恭喜你又活过了一天！</p>
          <p className="text-emerald-600 text-sm">今天也辛苦了</p>
        </div>
      )}

      {/* Daily Info Card */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          💡 每日信息差
        </h2>
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
          <p className="text-white/80 text-xs mb-2">2024年1月10日</p>
          <p className="font-medium mb-3">
            "人生中最重要的不是所站的位置，而是所朝的方向。"
          </p>
          <div className="flex items-center text-white/70 text-xs">
            <span>— 奥利弗·温德尔·霍姆斯</span>
          </div>
        </div>
      </section>

      {/* Quick Entry */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          ✍️ 今日有意义的事
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <textarea
            className="w-full h-20 p-0 border-none focus:ring-0 text-slate-700 placeholder-slate-300 resize-none outline-none"
            placeholder="记录下今天的一些有意义的事件..."
          />
          <div className="flex justify-between items-center mt-2 border-t pt-3">
            <div className="flex space-x-3">
              <button className="text-slate-400 hover:text-slate-600">🖼️</button>
              <button className="text-slate-400 hover:text-slate-600">😊</button>
            </div>
            <button className="bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors">
              保存记忆
            </button>
          </div>
        </div>
      </section>

      {/* Missed Day Hint */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
        <p className="text-sky-700 text-sm">
          ℹ️ 一定是因为昨天过的很开心吧，才忘了打卡。
        </p>
      </div>
    </div>
  );
}
