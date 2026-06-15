export default function Loading() {
  return (
    <div className="min-h-screen protocol-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'rgba(201,162,39,0.2)',
            borderTopColor: '#c9a227',
          }}
        />
        <p
          className="text-[10px] font-black uppercase tracking-[0.3em]"
          style={{ color: '#c9a227' }}
        >
          Loading
        </p>
      </div>
    </div>
  );
}
