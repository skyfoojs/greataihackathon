import Image
 from "next/image";
export default function Navbar() {
  return (
    <header className="border-b border-white/10 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" width={40} height={40} alt="HealthAI Logo" />
          <h1 className="text-xl font-bold">HealthAI</h1>
        </div>
      </div>
    </header>
  );
}
