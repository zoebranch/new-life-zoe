import Link from "next/link";

export default function CellsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between p-4 md:px-10 shadow bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo red.png" className="w-10 h-10" alt="logo" />
          <div><p className="font-black text-sm text-black">NEW LIFE CHRISTIAN CENTER</p><p className="text-xs text-red-600 font-bold">ZOE BRANCH / CELLS</p></div>
        </div>
        <Link href="/" className="bg-black text-white px-5 py-2 rounded-full text-sm font-bold">← Home</Link>
      </header>

      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Life Group Cells</h1>
        <p className="text-gray-600 mb-8">Small families, big growth. Find your family.</p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border-2 border-red-100 p-6 rounded-2xl hover:shadow-lg transition"><h3 className="font-bold">Lusaka Central</h3><p className="text-sm text-gray-600 mt-2">Wed 18:00 | Main Auditorium</p><button className="mt-4 text-red-600 font-bold text-sm">Join Cell →</button></div>
          <div className="border-2 border-red-100 p-6 rounded-2xl hover:shadow-lg transition"><h3 className="font-bold">Matero Cell</h3><p className="text-sm text-gray-600 mt-2">Thu 17:30 | Matero</p><button className="mt-4 text-red-600 font-bold text-sm">Join Cell →</button></div>
          <div className="border-2 border-red-100 p-6 rounded-2xl hover:shadow-lg transition"><h3 className="font-bold">Kabulonga Cell</h3><p className="text-sm text-gray-600 mt-2">Fri 18:00 | Kabulonga</p><button className="mt-4 text-red-600 font-bold text-sm">Join Cell →</button></div>
        </div>
      </div>
    </div>
  );
}