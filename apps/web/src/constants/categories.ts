export interface Quality {
  value: "SD" | "HD" | "FHD" | "4K";
  label: string;
  color: string;
  badgeClass: string;
}

export const QUALITIES: Quality[] = [
  { value: "4K", label: "4K", color: "gold", badgeClass: "bg-yellow-500 text-black" },
  { value: "FHD", label: "1080p", color: "purple", badgeClass: "bg-purple-500 text-white" },
  { value: "HD", label: "720p", color: "blue", badgeClass: "bg-blue-500 text-white" },
  { value: "SD", label: "480p", color: "gray", badgeClass: "bg-gray-500 text-white" },
];

export interface CategoryInfo {
  id: string;
  ar: string;
  en: string;
  icon: string; // lucide-react icon name
  gradient: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "all", ar: "الكل", en: "All", icon: "globe", gradient: "from-gray-500 to-gray-600" },
  { id: "favorites", ar: "المفضلة", en: "Favorites", icon: "star", gradient: "from-yellow-400 to-orange-500" },
  { id: "sports", ar: "رياضة", en: "Sports", icon: "trophy", gradient: "from-green-500 to-emerald-600" },
  { id: "news", ar: "أخبار", en: "News", icon: "newspaper", gradient: "from-red-500 to-rose-600" },
  { id: "movies", ar: "أفلام", en: "Movies", icon: "film", gradient: "from-purple-500 to-violet-600" },
  { id: "series", ar: "مسلسلات", en: "Series", icon: "tv", gradient: "from-blue-500 to-cyan-600" },
  { id: "entertainment", ar: "ترفيه", en: "Entertainment", icon: "smile", gradient: "from-pink-500 to-rose-500" },
  { id: "kids", ar: "أطفال", en: "Kids", icon: "baby", gradient: "from-yellow-400 to-orange-500" },
  { id: "religious", ar: "دينية", en: "Religious", icon: "church", gradient: "from-teal-500 to-green-600" },
  { id: "music", ar: "موسيقى", en: "Music", icon: "music", gradient: "from-indigo-500 to-purple-500" },
  { id: "documentary", ar: "وثائقي", en: "Documentary", icon: "bookOpen", gradient: "from-amber-500 to-yellow-600" },
  { id: "comedy", ar: "كوميدي", en: "Comedy", icon: "smile", gradient: "from-fuchsia-500 to-pink-600" },
];

export const COUNTRIES = [
  { code: "IQ", nameAr: "العراق", nameEn: "Iraq" },
  { code: "SA", nameAr: "السعودية", nameEn: "Saudi Arabia" },
  { code: "AE", nameAr: "الإمارات", nameEn: "UAE" },
  { code: "EG", nameAr: "مصر", nameEn: "Egypt" },
  { code: "QA", nameAr: "قطر", nameEn: "Qatar" },
  { code: "KW", nameAr: "الكويت", nameEn: "Kuwait" },
  { code: "TR", nameAr: "تركيا", nameEn: "Turkey" },
  { code: "US", nameAr: "الولايات المتحدة", nameEn: "USA" },
  { code: "GB", nameAr: "بريطانيا", nameEn: "UK" },
  { code: "FR", nameAr: "فرنسا", nameEn: "France" },
];
