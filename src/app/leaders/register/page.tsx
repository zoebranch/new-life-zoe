import Link from "next/link";

export default function LeaderRegistrationUnavailablePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white grid place-items-center p-5">
      <section className="w-full max-w-[400px] bg-[#111] border border-white/[0.06] rounded-[24px] p-8 text-center">
        <h1 className="font-black text-xl">Leader accounts are created by the church</h1>
        <p className="text-gray-400 text-sm mt-3">
          Please ask the pastor or Super Admin to create your login and give you the sign-in details.
        </p>
        <Link href="/leaders" className="inline-block mt-6 bg-[#E10600] rounded-full px-6 py-3 font-bold text-sm">
          Go to leader sign in
        </Link>
      </section>
    </main>
  );
}
