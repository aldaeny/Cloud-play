import React, { useState, useRef } from 'react';

// Stage 4: IPTV Live Stream Section (Reference/Coming Soon - Assumption 2: VOD First)
// Inspired by Cloud Play Design Reference (beIN, MBC, OSN)

export default function IptvSection() {
  const [channel, setChannel] = useState({
    name: 'beIN SPORTS 1 HD (Reference)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', // Placeholder
  });

  const channels = [
    { id: 'bein', name: 'beIN SPORTS 1 HD', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
    { id: 'mbc', name: 'MBC Action', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4' },
    { id: 'osn', name: 'OSN Movies HD', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
  ];

  return (
    <section id="iptv-section" className="py-10 px-4 md:px-12 max-w-7xl mx-auto w-full">
      <div className="bg-[#121217] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              IPTV Live Stream (مرجعي - قريباً)
            </span>
            <h2 className="text-2xl font-black">بث مباشر للقنوات الرياضية والترفيهية</h2>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {channels.map(c => (
              <button
                key={c.id}
                onClick={() => setChannel(c)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-[#ff2085]/20 text-xs font-bold transition-all border border-white/10 hover:border-[#ff2085]"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 group">
          <video
            id="iptv-video-player"
            className="w-full h-full object-contain"
            controls
            poster="https://placehold.co/1280x720/0a0a0c/00e5ff?text=Aether+IPTV+Live"
          >
            <source src={channel.url} type="video/mp4" />
            متصفحك لا يدعم مشغل الفيديو.
          </video>
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white border border-white/20 flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span>{channel.name}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
