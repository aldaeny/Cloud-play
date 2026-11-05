import { Channel } from '@/types/channel';

// Mock API / M3U Parser
// في الواقع، سيتم جلب البيانات من API أو تحليل ملف M3U
export async function fetchChannels(): Promise<Channel[]> {
  // محاكاة جلب 245 قناة (مثال)
  const categories: ChannelCategory[] = [
    "sports", "news", "movies", "series", "entertainment", "kids", "religious", "music", "documentary", "education", "comedy", "general"
  ];

  const countries = [
    { code: "IQ", name: "العراق", lang: "Arabic" },
    { code: "SA", name: "السعودية", lang: "Arabic" },
    { code: "AE", name: "الإمارات", lang: "Arabic" },
    { code: "EG", name: "مصر", lang: "Arabic" },
    { code: "TR", name: "تركيا", lang: "Turkish" },
    { code: "US", name: "أمريكا", lang: "English" }
  ];

  const channels: Channel[] = [];
  
  // توليد قنوات تجريبية (مثلاً 245 قناة)
  for (let i = 1; i <= 245; i++) {
    const country = countries[Math.floor(Math.random() * countries.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const quality: "SD" | "HD" | "FHD" | "4K" = i % 4 === 0 ? "4K" : i % 3 === 0 ? "FHD" : i % 2 === 0 ? "HD" : "SD";
    const qualityLabel = quality === "4K" ? "2160p" : quality === "FHD" ? "1080p" : quality === "HD" ? "720p" : "480p";

    channels.push({
      id: `ch-${i}`,
      name: `${country.name} - القناة ${i} (${category})`,
      logo: `https://cdn.example.com/logos/ch-${i}.png`, // رابط شعار تجريبي
      streamUrl: `https://stream.example.com/live/${i}.m3u8`,
      streamType: "hls",
      category,
      country: country.name,
      countryCode: country.code,
      language: country.lang,
      quality,
      qualityLabel,
      isLive: true,
      isFavorite: false,
      headers: {
        "User-Agent": "CloudPlay/1.0 (iOS; Iraq)",
        "Referer": "https://cloud-play-iraq.vercel.app"
      }
    });
  }

  return channels;
}

// حفظ سجل المشاهدة في LocalStorage
export function saveWatchHistory(channel: Channel) {
  const history = JSON.parse(localStorage.getItem('cloud-play-history') || '[]') as Channel[];
  const filtered = history.filter(c => c.id !== channel.id);
  filtered.unshift(channel);
  localStorage.setItem('cloud-play-history', JSON.stringify(filtered.slice(0, 20)));
}

export function getWatchHistory(): Channel[] {
  return JSON.parse(localStorage.getItem('cloud-play-history') || '[]') as Channel[];
}

// حفظ المفضلة
export function toggleFavorite(channel: Channel) {
  const favs = JSON.parse(localStorage.getItem('cloud-play-favorites') || '[]') as string[];
  const index = favs.indexOf(channel.id);
  if (index > -1) {
    favs.splice(index, 1);
  } else {
    favs.push(channel.id);
  }
  localStorage.setItem('cloud-play-favorites', JSON.stringify(favs));
  return favs.includes(channel.id);
}

export function isFavorite(channelId: string): boolean {
  const favs = JSON.parse(localStorage.getItem('cloud-play-favorites') || '[]') as string[];
  return favs.includes(channelId);
}
