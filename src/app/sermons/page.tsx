import Link from "next/link";
export default function SermonsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between p-4 md:px-10 shadow bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo red.png" className="w-10 h-10" alt="logo" />
          <div><p className="font-black text-sm text-black">NEW LIFE CHRISTIAN CENTER</p><p className="text-xs text-red-600 font-bold">ZOE BRANCH / SERMONS</p></div>
        </div>
        <Link href="/" className="bg-black text-white px-5 py-2 rounded-full text-sm font-bold">← Home</Link>
      </header>
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Sermons - ZOE Life</h1>
        <p className="text-gray-600 mb-8">John 10:10 - The God Kind of Life</p>
        <div className="space-y-4">
          <div className="flex gap-4 border p-4 rounded-xl"><div className="w-20 h-20 bg-red-100 rounded-lg"></div><div><p className="font-bold">The Abundant Life</p><p className="text-sm text-gray-500">Pastor | Sunday</p></div></div>
          <div className="flex gap-4 border p-4 rounded-xl"><div className="w-20 h-20 bg-red-100 rounded-lg"></div><div><p className="font-bold">Understanding Zoe</p><p className="text-sm text-gray-500">Midweek</p></div></div>
        </div>
      </div>
    </div>
  );
}