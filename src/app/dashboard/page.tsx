export default function Dashboard() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">QRON Studio Telemetry</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-gray-800 rounded-xl bg-black text-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-400 tracking-wider">TOTAL VERIFICATIONS</h3>
          <p className="text-4xl font-bold text-blue-500 mt-2">2.4M+</p>
        </div>
        <div className="p-6 border border-gray-800 rounded-xl bg-black text-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-400 tracking-wider">GLOBAL LATENCY</h3>
          <p className="text-4xl font-bold text-green-500 mt-2">&lt; 2s</p>
        </div>
        <div className="p-6 border border-gray-800 rounded-xl bg-black text-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-400 tracking-wider">ACTIVE EDGE NODES</h3>
          <p className="text-4xl font-bold text-purple-500 mt-2">300+</p>
        </div>
      </div>
    </div>
  );
}
