import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { CheckInApi } from "@stillalive/api";
import {
  MILESTONE_DAYS,
  getMilestoneMessage,
  getNextMilestone,
} from "@stillalive/core";
import ThemeToggle from "@/components/ThemeToggle";

export default function MilestonePage() {
  const { api } = useAuth();
  const checkinApi = useMemo(() => new CheckInApi(api), [api]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    checkinApi
      .stats()
      .then((r) => r.success && r.data && setStreak(r.data.consecutiveDays));
  }, [checkinApi]);

  const current = [...MILESTONE_DAYS].reverse().find((d) => streak >= d) ?? 0;
  const next = getNextMilestone(streak);
  const msg =
    current > 0
      ? getMilestoneMessage(current as (typeof MILESTONE_DAYS)[number])
      : "开始你的第一天";

  return (
    <div className="min-h-screen bg-sa-bg transition-colors duration-500">
      <div className="max-w-[430px] mx-auto min-h-screen flex flex-col px-7">
        <header className="flex justify-between items-center pt-8">
          <Link
            to="/checkin"
            className="text-sa-ink-faint text-sm hover:text-sa-life"
          >
            ← Back
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="relative w-[200px] h-[200px] animate-breathe animate-drift">
            <div className="absolute inset-[-32px] rounded-full border border-sa-life opacity-20" />
            <div className="absolute inset-[-16px] rounded-full border border-sa-life opacity-40 animate-breathe-glow" />
            <div className="absolute inset-0 rounded-full border border-sa-life" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-[96px] leading-none text-sa-life">
                {current || streak}
              </span>
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-sa-life flex items-center justify-center text-sa-bg animate-drift">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 9H4a2 2 0 01-2-2V5h4M18 9h2a2 2 0 002-2V5h-4M6 4h12v6a6 6 0 01-12 0V4zM10 17h4M9 21h6M12 17v4" />
              </svg>
            </div>
          </div>

          <p className="font-mono text-[11px] tracking-[0.3em] text-sa-ink-faint uppercase mt-14 animate-fade-up">
            MILESTONE · {current || streak} DAYS
          </p>
          <h1
            className="font-body font-bold text-[28px] leading-snug mt-4 max-w-[280px] animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            {msg || `${streak} 天`}
          </h1>

          <div
            className="border-y border-sa-line py-8 mt-10 max-w-[320px] font-display italic text-[15px] leading-[1.85] text-sa-ink-soft animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            {current > 0 ? (
              <>
                {current} 个"还活着"，
                <br />
                拼成了只属于你的勋章。
                <br />
                认真地活，认真地记录，
                <br />
                这件事本身就很了不起。
              </>
            ) : (
              <>
                每一次打卡，
                <br />
                都是确认自己仍在的仪式。
              </>
            )}
          </div>
        </div>

        <div
          className="border-t border-sa-line py-8 animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="font-mono text-[10px] tracking-[0.2em] text-sa-ink-faint uppercase mb-4">
            All milestones · 全部里程碑
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MILESTONE_DAYS.map((d) => {
              const done = streak >= d;
              const isCurrent = d === current;
              return (
                <div
                  key={d}
                  className={`flex-shrink-0 py-4 px-5 min-w-[80px] text-center border ${
                    isCurrent
                      ? "bg-sa-life-soft border-sa-life text-sa-life ring-2 ring-sa-life ring-offset-2 ring-offset-sa-bg"
                      : done
                        ? "bg-sa-green-soft border-sa-green text-sa-green"
                        : "border-sa-line text-sa-ink-faint"
                  }`}
                >
                  <div className="font-display text-2xl leading-none">{d}</div>
                  <div className="font-mono text-[9px] tracking-wider mt-1 uppercase">
                    {isCurrent
                      ? "NOW"
                      : done
                        ? "DONE"
                        : next === d
                          ? `+${d - streak}`
                          : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pb-8">
          <Link
            to="/"
            className="block w-full py-[18px] bg-sa-ink text-sa-bg text-center font-display italic text-base tracking-wider hover:bg-sa-life transition-colors"
          >
            Continue · 继续活着 →
          </Link>
        </div>
      </div>
    </div>
  );
}
