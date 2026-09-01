import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 items-center sm:items-start text-center sm:text-left">
        <h1 className="text-4xl font-bold">Locofoot Platform</h1>
        <p className="text-lg">Football Tournament Management</p>
        <div className="flex gap-4">
          <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded">
            Login
          </Link>
          <Link href="/register" className="bg-gray-200 text-black px-4 py-2 rounded">
            Register
          </Link>
        </div>
      </main>
    </div>
  );
}
