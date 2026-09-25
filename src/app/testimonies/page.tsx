import Link from "next/link";
export default function TestimoniesPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between p-4 md:px-10 shadow bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo red.png" className="w-10 h-10" alt="logo" />
          <div><p className="font-black text-sm text-black">NEW LIFE CHRISTIAN CENTER</p><p className="text-xs text-red-600 font-bold">ZOE BRANCH / TESTIMONIES</p></div>
        </div>
        <Link href="/" className="bg-black text-white px-5 py-2 rounded-full text-sm font-bold">← Home</Link>
      </header>
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Testimonies</h1>
        <p className="text-gray-600 mb-8">What God is doing at Zoe Branch</p>
        <div className="grid gap-4">
          <div className="border p-6 rounded-2xl bg-red-50/50"><p className="italic">"God healed me in Zoe Branch cell..."</p><p className="font-bold mt-3 text-sm">- Sister Grace</p></div>
          <div className="border p-6 rounded-2xl bg-red-50/50"><p className="italic">"My business broke through after the Zoe teaching..."</p><p className="font-bold mt-3 text-sm">- Brother John</p></div>
        </div>
      </div>
    </div>
  );
}