"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Matching", description: "Recommend & launch courses" },
  { href: "/candidates", label: "Candidates", description: "Manage learner gaps" },
  { href: "/courses", label: "Courses", description: "Coursebox catalog" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="border-b border-slate-200 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Coursebox
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">Skill-Match</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="block font-medium">{item.label}</span>
                <span
                  className={`block text-xs ${
                    active ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {item.description}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
