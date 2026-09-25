"use client";
import Link from "next/link";
import { useState } from "react";

export default function EvangelismPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between p-4 md:px-10 shadow sticky top-0 bg-white z-50">
        <div className="flex items-center gap-3">
          <img src="/logo red.png" alt="logo" className="w-12 h-12 object-contain" />
          <div className="leading-tight">
            <h1 className="font-black text-[13px] md:text-[15px] text-black">NEW LIFE CHRISTIAN CENTER</h1>
            <p className="text-[11px] text-red-600 font-bold tracking-widest">ZOE BRANCH</p>
          </div>
        </div>
        <nav className="hidden md:flex gap-8 font-bold text-sm">
          <Link href="/">Home</Link>
          <Link href="/cells">Cells</Link>
          <Link href="/evangelism" className="text-red-600">Evangelism</Link>
          <Link href="/sermons">Sermons</Link>
        </nav>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-2xl">☰</button>
      </header>

      <section className="bg-black text-white py-16 px-6 md:px-16 text-center">
        <p className="text-red-500 font-bold tracking-widest text-xs mb-3">SATURDAY OUTREACH</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4">Evangelism Per Cell<br/><span className="text-red-500">Every Saturday</span></h1>
        <p className="text-white/70 max-w-2xl mx-auto">Each cell goes out to win souls and demonstrate the love of Christ in our communities. Mark 16:15</p>
      </section>

      <section className="py-12 px-6 md:px-16 max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        <div className="bg-gray-50 p-8 rounded-2xl border-t-4 border-red-600">
          <h3 className="font-black text-lg mb-2">⏰ TIME</h3>
          <p className="font-bold">Every Saturday</p>
          <p className="text-gray-600 text-sm">09:00 - 12:00</p>
        </div>
        <div className="bg-gray-50 p-8 rounded-2xl border-t-4 border-black">
          <h3 className="font-black text-lg mb-2">📍 WHERE</h3>
          <p className="font-bold">Per Cell Location</p>
          <p className="text-gray-600 text-sm">Each cell in its own area</p>
        </div>
        <div className="bg-gray-50 p-8 rounded-2xl border-t-4 border-red-600">
          <h3 className="font-black text-lg mb-2">🎯 MISSION</h3>
          <p className="font-bold">Soul Winning</p>
          <p className="text-gray-600 text-sm">Go ye into all the world - Mark 16:15</p>
        </div>
      </section>

      <section className="px-6 md:px-16 max-w-6xl mx-auto pb-16">
        <div className="bg-red-600 text-white p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-2xl font-black">Be Part of Saturday Evangelism</h3>
            <p className="text-white/80 text-sm mt-1">Join a cell near you and let's win Lusaka for Jesus!</p>
          </div>
          <Link href="/cells" className="bg-white text-red-600 px-8 py-3 rounded-full font-black">Join a Cell</Link>
        </div>
      </section>
    </div>
  );
}