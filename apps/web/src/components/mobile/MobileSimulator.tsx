import React from 'react';

// Stage 4: Mobile App Simulator (Inspired by Cloud Play Design)
export default function MobileSimulator() {
  return (
    <section id="mobile-app-view" className="py-12 px-4 md:px-12 max-w-7xl mx-auto w-full">
      <div className="text-center mb-10">
        <span className="text-xs font-bold text-[#00e5ff] uppercase tracking-widest">05. APP MOBILE</span>
        <h2 className="text-3xl font-black">تجربة التطبيق على الهاتف الذكي</h2>
        <p className="text-gray-400 text-sm mt-2">تصفح مرن وتصميم تفاعلي مخصص لأجهزة iOS و Android</p>
      </div>

      <div className="flex justify-center">
        {/* Phone Simulator Frame */}
        <div className="phone-frame w-[340px] h-[680px] bg-[#0a0a0c] relative overflow-hidden flex flex-col justify-between">
          {/* Top Notch & Status Bar */}
          <div className="pt-3 px-6 flex justify-between items-center text-xs text-gray-400 z-20">
            <span>9:41</span>
            <div className="w-20 h-4 bg-black rounded-full mx-auto" />
            <div className="flex items-center gap-1">
              <i className="fa-solid fa-signal" />
              <i className="fa-solid fa-wifi" />
              <i className="fa-solid fa-battery-full" />
            </div>
          </div>

          {/* App Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/5 z-20">
            <span className="font-black text-lg">Aether</span>
            <div className="flex items-center gap-3 text-sm">
              <i className="fa-solid fa-magnifying-glass" />
              <i className="fa-regular fa-bell" />
            </div>
          </div>

          {/* App Body Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Mobile Featured Slide */}
            <div>
              <span className="text-[10px] font-bold text-[#00e5ff] uppercase">FEATURED</span>
              <div className="relative w-full h-[240px] rounded-2xl overflow-hidden mt-2 border border-white/10 shadow-lg">
                <img src="https://placehold.co/300x400/0f1015/ffb000?text=BEYOND" className="w-full h-full object-cover" alt="Featured" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent" />
                <div className="absolute bottom-3 inset-x-3 text-center">
                  <h4 className="font-black text-lg">BEYOND HORIZON</h4>
                  <div className="flex justify-center gap-1 my-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                  </div>
                  <button className="btn-gradient-play w-full py-1.5 rounded-lg text-xs font-bold mt-1">
                    <i className="fa-solid fa-play" /> PLAY NOW
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Trending Row */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-300">TRENDING</span>
                <span className="text-[10px] text-[#00e5ff]">See all</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-24 shrink-0 rounded-xl overflow-hidden bg-[#121217] border border-white/5">
                    <img src={`https://placehold.co/150x200/121217/${i === 1 ? 'ff2085' : i === 2 ? '00e5ff' : '7b30ff'}?text=TITLE${i}`} className="w-full h-32 object-cover" alt="Trending" />
                    <div className="p-1.5 text-center">
                      <p className="text-[10px] font-bold truncate">TITLE {i}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <div className="bg-[#121217]/95 border-t border-white/10 py-3 px-6 flex justify-between items-center text-gray-400 text-lg z-20">
            <button className="text-[#00e5ff]"><i className="fa-solid fa-house" /></button>
            <button className="hover:text-white"><i className="fa-solid fa-tv" /></button>
            <button className="hover:text-white"><i className="fa-solid fa-download" /></button>
            <button className="hover:text-white"><i className="fa-solid fa-user" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
