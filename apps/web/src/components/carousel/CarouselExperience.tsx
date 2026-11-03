import React, { useState } from 'react';

// Stage 4: 3D Carousel Experience (Inspired by Cloud Play Design)
const CARDS = [
  { id: 1, title: 'ECHOES', season: 'الموسم 2', episode: 'الحلقة 7', img: 'https://placehold.co/400x600/121217/00e5ff?text=ECHOES' },
  { id: 2, title: 'THE LAST SIGNAL', season: 'الموسم 1', episode: 'الحلقة 8', img: 'https://placehold.co/400x600/181824/ff2085?text=LAST+SIGNAL' },
  { id: 3, title: 'BEYOND HORIZON', season: 'الموسم 1', episode: 'الحلقة 4', img: 'https://placehold.co/400x600/0f1015/ffb000?text=BEYOND+HORIZON', featured: true },
  { id: 4, title: 'PARALLEL', season: 'الموسم 1', episode: 'الحلقة 3', img: 'https://placehold.co/400x600/1a1025/7b30ff?text=PARALLEL' },
  { id: 5, title: 'ORIGIN', season: 'الموسم 2', episode: 'الحلقة 2', img: 'https://placehold.co/400x600/101f25/00e5ff?text=ORIGIN' },
];

export default function Carousel() {
  const [currentIndex, setCurrentIndex] = useState(2); // Middle index

  const getCardClass = (index: number) => {
    const diff = index - currentIndex;
    if (diff === 0) return 'carousel-card active w-[260px] md:w-[310px] h-[400px]';
    if (diff === -1) return 'carousel-card prev';
    if (diff === 1) return 'carousel-card next';
    if (diff <= -2) return 'carousel-card far-prev';
    if (diff >= 2) return 'carousel-card far-next';
    return '';
  };

  return (
    <section className="relative py-10 px-4 md:px-12 overflow-hidden min-h-[580px] flex flex-col justify-center">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-r from-[#7b30ff]/20 via-[#ff2085]/20 to-[#00e5ff]/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex items-center justify-between mb-6 z-10 max-w-7xl mx-auto w-full">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-[#00e5ff] font-bold">06. WEBSITE INTERFACE</h2>
          <h1 className="text-2xl md:text-3xl font-black font-cairo">3D CAROUSEL EXPERIENCE</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="w-10 h-10 rounded-full border border-white/20 bg-[#121217]/80 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95">
            <i className="fa-solid fa-chevron-right text-white" />
          </button>
          <button onClick={() => setCurrentIndex(Math.min(CARDS.length - 1, currentIndex + 1))} className="w-10 h-10 rounded-full border border-white/20 bg-[#121217]/80 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95">
            <i className="fa-solid fa-chevron-left text-white" />
          </button>
        </div>
      </div>

      <div className="carousel-container relative w-full max-w-6xl mx-auto h-[400px] flex items-center justify-center z-10">
        {CARDS.map((card, index) => (
          <div
            key={card.id}
            className={`carousel-card absolute w-[240px] md:w-[280px] h-[380px] rounded-2xl overflow-hidden bg-[#121217] border border-white/10 shadow-2xl flex flex-col justify-end p-5 ${getCardClass(index)}`}
          >
            <img src={card.img} alt={card.title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent" />
            <div className="relative z-10 text-center flex flex-col items-center">
              {card.featured && (
                <span className="bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 px-3 py-0.5 rounded-full text-xs font-bold mb-2">
                  مميز اليوم
                </span>
              )}
              <h3 className={`font-black text-2xl md:text-3xl mb-1 text-white tracking-wide ${card.featured ? '' : 'text-gray-300'}`}>
                {card.title}
              </h3>
              <p className="text-xs text-gray-300 mb-4">{card.season} • {card.episode} | خيال علمي / دراما</p>
              {card.featured && (
                <button className="btn-gradient-play w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm text-white">
                  <i className="fa-solid fa-play" />
                  <span>شاهد الآن - PLAY NOW</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getCardClass(index: number, currentIndex: number) {
  const diff = index - currentIndex;
  if (diff === 0) return 'carousel-card active w-[260px] md:w-[310px] h-[400px]';
  if (diff === -1) return 'carousel-card prev';
  if (diff === 1) return 'carousel-card next';
  if (diff <= -2) return 'carousel-card far-prev';
  if (diff >= 2) return 'carousel-card far-next';
  return '';
}
