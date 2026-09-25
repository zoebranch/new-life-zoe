"use client";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 md:px-10 shadow sticky top-0 bg-white z-50">
        <div className="flex items-center gap-3">
          <img src="/logo red.png" alt="logo" className="w-12 h-12 object-contain" />
          <div className="leading-tight">
            <h1 className="font-black text-[13px] md:text-[15px] text-black tracking-wide">NEW LIFE CHRISTIAN CENTER</h1>
            <p className="text-[11px] text-red-600 font-bold tracking-widest">ZOE BRANCH</p>
          </div>
        </div>
        <nav className="hidden md:flex gap-8 font-bold text-sm text-gray-800">
          <Link href="/" className="text-red-600">Home</Link>
          <Link href="/cells" className="hover:text-red-600">Cells</Link>
          <Link href="/sermons" className="hover:text-red-600">Sermons</Link>
          <Link href="/testimonies" className="hover:text-red-600">Testimonies</Link>
        </nav>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-2xl text-black">☰</button>
      </header>

      {menuOpen && (
        <div className="md:hidden flex flex-col bg-white shadow p-4 gap-4 font-bold text-sm border-t">
          <Link href="/" onClick={() => setMenuOpen(false)} className="text-red-600">Home</Link>
          <Link href="/cells" onClick={() => setMenuOpen(false)}>Cells</Link>
          <Link href="/sermons" onClick={() => setMenuOpen(false)}>Sermons</Link>
          <Link href="/testimonies" onClick={() => setMenuOpen(false)}>Testimonies</Link>
        </div>
      )}

      {/* PASTOR HERO */}
      <section className="relative h-[85vh] w-full overflow-hidden bg-black">
        <img src="/pastor.jpg" alt="Pastor" className="absolute inset-0 w-full h-full object-cover object-top opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        <div className="relative z-10 h-full flex flex-col justify-end p-6 md:px-16 max-w-6xl mx-auto pb-20">
          <p className="text-red-400 font-bold tracking-widest text-sm mb-3">WELCOME TO ZOE BRANCH</p>
          <h2 className="text-4xl md:text-6xl font-black text-white leading-[1.1] mb-4">
            Experience The<br/><span className="text-red-500">God Kind</span> of Life
          </h2>
          <p className="text-white/80 text-lg max-w-xl mb-8">John 10:10 - I have come that they may have Life.</p>
          <div className="flex gap-4 flex-wrap">
            <Link href="/cells" className="bg-red-600 text-white px-8 py-3 rounded-full font-bold">Join a Cell</Link>
            <Link href="/sermons" className="bg-white text-black px-8 py-3 rounded-full font-bold">Our Sermons</Link>
          </div>
        </div>
      </section>

      {/* ABOUT - MAKE IT NOT DRY */}
      <section className="py-16 px-6 md:px-16 max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-red-600 font-bold tracking-widest text-xs mb-3">AT NEW LIFE ZOE</p>
          <h3 className="text-3xl md:text-4xl font-black text-black mb-4 leading-tight">A Family Built On The Word & Love</h3>
          <p className="text-gray-600 leading-relaxed mb-6">
            At New Life Christian Center Zoe Branch, we are more than a church - we are family.
            Our mandate is to raise believers, to prepare the people of God for ZOE - The God Kind of Life. Based on John 10:10b "I have come that they may have life,and that they may have it more abundantly"(NKJV) 
          </p>
          <div className="flex gap-4">
            <Link href="/evangelism" className="text-red-600 font-black border-b-2 border-red-600 pb-1">Find Your Family →</Link>
          </div>
        </div>
                <div>
          <p className="text-red-600 font-bold tracking-widest text-xs mb-3">SERVICES</p>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-50 p-6 rounded-2xl border-l-4 border-red-600">
              <h4 className="font-black text-black mb-1">TUESDAY - CELL MEETINGS</h4>
              <p className="text-sm text-gray-600 font-bold">18:00 - 19:00</p>
              <p className="text-xs text-gray-500 mt-1">Fellowship in homes across Lusaka</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl border-l-4 border-black">
              <h4 className="font-black text-black mb-1">WEDNESDAY - MIDWEEK SERVICE</h4>
              <p className="text-sm text-gray-600 font-bold">17:30 - 19:00</p>
              <p className="text-xs text-gray-500 mt-1">Word and strengthening at church</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl border-l-4 border-red-600">
              <h4 className="font-black text-black mb-1">SUNDAY - MAIN SERVICES</h4>
              <p className="text-sm text-gray-600 font-bold">1st: 07:30 - 10:00 | 2nd: 10:30 - 13:00</p>
              <p className="text-xs text-gray-500 mt-1">Two powerful services</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER - PROFESSIONAL CHURCH FOOTER */}
      <footer className="bg-[#0a0a0a] text-white pt-16 pb-8 px-6 md:px-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
          {/* Logo & About */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo red.png" alt="logo" className="w-10 h-10 object-contain bg-white rounded-full p-1" />
              <div>
                <h4 className="font-black text-sm">NEW LIFE CHRISTIAN CENTER</h4>
                <p className="text-[10px] text-red-500 font-bold tracking-widest">ZOE BRANCH</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-md">
              Raising a people who live the God-kind of life. Join us every Sunday for a life-transforming experience in the Word. All are welcome.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-black text-sm mb-4 tracking-widest">QUICK LINKS</h4>
            <div className="flex flex-col gap-2 text-sm text-gray-400">
              <Link href="/" className="hover:text-white">Home</Link>
              <Link href="/cells" className="hover:text-white">Join a Cell</Link>
              <Link href="/sermons" className="hover:text-white">Sermons</Link>
              <Link href="/testimonies" className="hover:text-white">Testimonies</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-black text-sm mb-4 tracking-widest">CONTACT US</h4>
            <div className="flex flex-col gap-2 text-sm text-gray-400">
              <p>📍 Lusaka, Zambia</p>
              <p>📞 +260 97X XXX XXX</p>
              <p>✉️ zoe@newlifecc.org</p>
              <p className="mt-2">🕒 Sun: 8AM - 11AM</p>
            </div>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500 text-center md:text-left">
            © 2026 New Life Christian Center - Zoe Branch. All Rights Reserved. <br className="md:hidden"/>
            <span className="text-gray-600">Built with love for the Kingdom.</span>
          </p>
          <p className="text-xs text-gray-600">Jesus is Lord! | Zoe - The God Kind of Life</p>
        </div>
      </footer>
    </div>
  );
}