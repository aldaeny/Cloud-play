'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { Channel } from '@/types/channel';
import { fetchChannels } from '@/lib/channels';
import { Favorites, WatchHistory } from '@/lib/storage';

export default function ChannelDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!id) {
      router.push('/live');
      return;
    }
    
    // جلب القنوات والبحث عن القناة المطلوبة
    const load = async () => {
      const data = await fetchChannels();
      const found = data.find(c => c.id === id);
      if (found) {
        setChannel(found);
        WatchHistory.add(found); // إضافة للسجل
        setFavorites(Favorites.get());
      } else {
        router.push('/live');
      }
    };
    load();
  }, [id, router]);

  if (!channel) return <div className="p-8 text-center text-gray-500">جاري التحميل...</div>;

  const toggleFav = () => {
    const newFavs = Favorites.toggle(channel.id);
    setFavorites(newFavs);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* Player Section */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-2xl relative">
          <button 
            onClick={() => router.back()}
            className="absolute top-4 left-4 z-20 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
          >
            ←
          </button>
          <VideoPlayer 
            src={channel.streamUrl}
            type={channel.streamType}
            poster={channel.logo}
            title={channel.name}
            isLive={channel.isLive}
            headers={channel.headers}
            onReady={() => console.log("Player ready")}
          />
        </div>

        {/* Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-bold mb-4">{channel.name}</h1>
            <div className="flex gap-4 mb-6">
              <button 
                onClick={toggleFav}
                className={`px-6 py-2 rounded-full font-semibold transition-colors flex items-center gap-2 ${favorites.includes(channel.id) ? 'bg-yellow-400 text-black' : 'bg-[#A855F7] hover:bg-[#9345e7] text-white'}`}
              >
                {favorites.includes(channel.id) ? '★ إزالة من المفضلة' : '★ إضافة للمفضلة'}
              </button>
              <button className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-full font-semibold transition-colors">
                مشاركة
              </button>
            </div>
            
            <div className="bg-[#111] rounded-xl p-6 border border-white/5">
              <h2 className="text-xl font-semibold mb-4">دليل البرامج (EPG)</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded-lg">
                  <div>
                    <p className="text-sm text-gray-400">14:00 - 15:00</p>
                    <p className="font-medium">البرنامج الحالي</p>
                  </div>
                  <span className="bg-red-600 text-[10px] px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                </div>
                <div className="flex justify-between items-center p-3 opacity-60">
                  <div>
                    <p className="text-sm text-gray-400">15:00 - 16:00</p>
                    <p className="font-medium">البرنامج القادم</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#111] rounded-xl p-6 border border-white/5">
              <h2 className="text-xl font-semibold mb-4">معلومات</h2>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><strong>الدولة:</strong> {channel.country}</li>
                <li><strong>التصنيف:</strong> {channel.category}</li>
                <li><strong>الجودة:</strong> {channel.qualityLabel}</li>
                <li><strong>اللغة:</strong> {channel.language}</li>
              </ul>
            </div>
            
            <div className="bg-[#111] rounded-xl p-6 border border-white/5">
              <h2 className="text-xl font-semibold mb-4">قنوات مشابهة</h2>
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1a1a] cursor-pointer transition-colors">
                    <div className="w-12 h-8 bg-gray-800 rounded" />
                    <div>
                      <p className="font-medium">القناة المشابهة {i}</p>
                      <p className="text-xs text-gray-500">{channel.country} · {channel.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
