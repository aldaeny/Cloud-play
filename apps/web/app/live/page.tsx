'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Channel } from '@/types/channel';
import { fetchChannels } from '@/lib/channels';
import { Favorites, WatchHistory } from '@/lib/storage';
import { ChannelCard, ChannelGrid, CategoryFilter, CountryFilter, QualityFilter, ChannelSearch, ChannelSort } from '@/components/channels/ChannelCard';

export default function LivePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [country, setCountry] = useState("");
  const [quality, setQuality] = useState("");
  const [sort, setSort] = useState("name");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showLiveOnly, setShowLiveOnly] = useState(true);
  
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  const router = useRouter();

  // تحميل القنوات
  useEffect(() => {
    const load = async () => {
      const data = await fetchChannels();
      setChannels(data);
      setLoading(false);
      setFavorites(Favorites.get());
    };
    load();
  }, []);

  // تحديث المفضلة عند التغيير
  const handlePlay = (channel: Channel) => {
    WatchHistory.add(channel);
    setSelectedChannel(channel);
    router.push(`/live/${channel.id}`);
  };

  const toggleFav = (channelId: string) => {
    const newFavs = Favorites.toggle(channelId);
    setFavorites(newFavs);
  };

  // الفلترة والترتيب (باستخدام logic من player-utils)
  const filteredChannels = channels.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "all" && c.category !== category) return false;
    if (country && c.countryCode !== country) return false;
    if (quality && c.quality !== quality) return false;
    if (showFavoritesOnly && !favorites.includes(c.id)) return false;
    if (showLiveOnly && !c.isLive) return false;
    return true;
  });

  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const aFav = favorites.includes(a.id) ? 0 : 1;
    const bFav = favorites.includes(b.id) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;

    const aIraqi = a.countryCode === "IQ" ? 0 : 1;
    const bIraqi = b.countryCode === "IQ" ? 0 : 1;
    if (aIraqi !== bIraqi) return aIraqi - bIraqi;

    // حسب الترتيب المختار
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "country") return a.country.localeCompare(b.country);
    if (sort === "quality") {
      const qOrder = { "4K": 0, "FHD": 1, "HD": 2, "SD": 3 };
      return (qOrder[a.quality] || 4) - (qOrder[b.quality] || 4);
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-20">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-[#111] border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">البث المباشر (TV)</h1>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showFavoritesOnly} 
              onChange={(e) => setShowFavoritesOnly(e.target.checked)}
              className="w-4 h-4 accent-[#A855F7]"
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">المفضلة فقط</span>
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 p-4">
        <ChannelSearch value={search} onChange={setSearch} />
        <div className="flex flex-wrap gap-4">
          <CategoryFilter active={category} onChange={setCategory} />
          <CountryFilter active={country} onChange={setCountry} />
          <QualityFilter active={quality} onChange={setQuality} />
          <ChannelSort value={sort} onChange={setSort} />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">جاري تحميل القنوات...</div>
      ) : sortedChannels.length === 0 ? (
        <div className="p-8 text-center text-gray-500">لا توجد قنوات مطابقة للبحث</div>
      ) : (
        <ChannelGrid 
          channels={sortedChannels} 
          onPlay={handlePlay}
          favorites={favorites}
          onFavoriteToggle={toggleFav}
        />
      )}

      {/* Channel Detail / Player Modal */}
      {selectedChannel && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-[#111] rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative">
              {/* Close Button */}
              <button 
                onClick={() => setSelectedChannel(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
              >
                ✕
              </button>
              
              <VideoPlayer 
                src={selectedChannel.streamUrl}
                type={selectedChannel.streamType}
                poster={selectedChannel.logo}
                title={selectedChannel.name}
                isLive={selectedChannel.isLive}
                headers={selectedChannel.headers}
                onReady={() => console.log("Player ready")}
              />
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedChannel.name}</h2>
                  <p className="text-gray-400">{selectedChannel.country} · {selectedChannel.category}</p>
                </div>
                <button 
                  onClick={() => toggleFav(selectedChannel.id)}
                  className={`p-3 rounded-full transition-colors ${favorites.includes(selectedChannel.id) ? 'bg-yellow-400 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={favorites.includes(selectedChannel.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 6a9.002 9.002 0 0 0-17.8 0 9.002 9.002 0 0 0 17.8 0z"></path></svg>
                </button>
              </div>
              
              {/* EPG / Info Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-semibold mb-3">دليل البرامج (EPG)</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-[#1a1a1a] rounded-lg border border-white/5">
                      <p className="text-sm text-gray-300">14:00 - 15:00 | البرنامج الحالي</p>
                      <p className="text-white font-medium">أخبار الساعة</p>
                    </div>
                    <div className="p-3 bg-[#1a1a1a] rounded-lg border border-white/5 opacity-60">
                      <p className="text-sm text-gray-300">15:00 - 16:00 | القادم</p>
                      <p className="text-white font-medium">نشرة الطقس</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-3">معلومات القناة</h3>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li><strong>الجودة:</strong> {selectedChannel.qualityLabel}</li>
                    <li><strong>اللغة:</strong> {selectedChannel.language}</li>
                    <li><strong>التصنيف:</strong> {selectedChannel.category}</li>
                    <li><strong>الدولة:</strong> {selectedChannel.country}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
