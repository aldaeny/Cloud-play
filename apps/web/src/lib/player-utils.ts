export function formatQuality(quality: "SD" | "HD" | "FHD" | "4K"): string {
  switch (quality) {
    case "4K": return "2160p";
    case "FHD": return "1080p";
    case "HD": return "720p";
    case "SD": return "480p";
    default: return "Unknown";
  }
}

export function getQualityColor(quality: "SD" | "HD" | "FHD" | "4K"): string {
  switch (quality) {
    case "4K": return "bg-yellow-500 text-black";
    case "FHD": return "bg-purple-500 text-white";
    case "HD": return "bg-blue-500 text-white";
    case "SD": return "bg-gray-500 text-white";
    default: return "bg-gray-400 text-white";
  }
}

export function getStreamType(url: string): "hls" | "dash" | "mp4" | "youtube" {
  if (url.includes('.m3u8')) return "hls";
  if (url.includes('.mpd')) return "dash";
  if (url.includes('.mp4')) return "mp4";
  if (url.includes('youtube.com') || url.includes('youtu.be')) return "youtube";
  return "hls"; // Default
}

// دالة لترتيب القنوات حسب الأولوية
export function sortChannels(channels: any[], favorites: string[], searchQuery: string = "", categoryFilter: string = "all", countryFilter: string = "", qualityFilter: string = "") {
  let result = [...channels];

  // 1. الفلترة
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.country.toLowerCase().includes(q) || 
      c.language.toLowerCase().includes(q)
    );
  }

  if (categoryFilter !== "all") {
    result = result.filter(c => c.category === categoryFilter);
  }

  if (countryFilter) {
    result = result.filter(c => c.countryCode === countryFilter);
  }

  if (qualityFilter) {
    result = result.filter(c => c.quality === qualityFilter);
  }

  // 2. الترتيب
  result.sort((a, b) => {
    // أ. المفضلة
    const aFav = favorites.includes(a.id) ? 0 : 1;
    const bFav = favorites.includes(b.id) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;

    // ب. القنوات العراقية أولاً
    const aIraqi = a.countryCode === "IQ" ? 0 : 1;
    const bIraqi = b.countryCode === "IQ" ? 0 : 1;
    if (aIraqi !== bIraqi) return aIraqi - bIraqi;

    // ج. حسب التصنيف
    if (a.category !== b.category) return a.category.localeCompare(b.category);

    // د. حسب الجودة (4K > FHD > HD > SD)
    const qOrder = { "4K": 0, "FHD": 1, "HD": 2, "SD": 3 };
    const aQ = qOrder[a.quality] || 4;
    const bQ = qOrder[b.quality] || 4;
    if (aQ !== bQ) return aQ - bQ;

    // هـ. أبجدياً
    return a.name.localeCompare(b.name);
  });

  return result;
}
