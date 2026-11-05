'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tv, Search, Filter, Star, Globe, Trophy, Newspaper, Film, Play, Smile, Baby, Church, Music, BookOpen, Laugh } from 'lucide-react';
import { CATEGORIES, COUNTRIES, QUALITIES } from '@/constants/categories';
import { Channel } from '@/types/channel';

// --- Channel Card ---
export function ChannelCard({ 
  channel, 
  onPlay, 
  favorites, 
  onFavoriteToggle 
}: { 
  channel: Channel; 
  onPlay: (c: Channel) => void;
  favorites: string[];
  onFavoriteToggle: (id: string) => void;
}) {
  const isFav = favorites.includes(channel.id);
  const qualityInfo = QUALITIES.find(q => q.value === channel.quality) || QUALITIES[1];

  return (
    <div className="group relative bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:-translate-y-1 transition-all duration-300">
      {/* LIVE Badge */}
      {channel.isLive && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-bold animate-pulse shadow-lg">
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
          LIVE
        </div>
      )}
      
      {/* Quality Badge */}
      <div className={`absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${qualityInfo.badgeClass}`}>
        {qualityInfo.label}
      </div>

      {/* Favorite Star */}
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFavoriteToggle(channel.id);
        }}
        className={`absolute top-3 right-12 z-10 p-1.5 rounded-full transition-colors ${isFav ? 'bg-yellow-400 text-white' : 'bg-white/20 text-white/70 hover:bg-white/40'}`}
      >
        <Star size={16} fill={isFav ? "currentColor" : "none"} />
      </button>

      {/* Logo Area */}
      <div className="aspect-[16/9] bg-gray-50 dark:bg-[#1a1a1a] flex items-center justify-center relative overflow-hidden">
        <img 
          src={channel.logo} 
          alt={channel.name}
          className="object-contain max-h-full max-w-full"
          loading="lazy"
        />
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{channel.name}</h3>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <span className="flex items-center gap-0.5">
            <Globe size={12} /> {channel.countryCode} {channel.country}
          </span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            {CATEGORIES.find(c => c.id === channel.category)?.icon ? (
              <span className="text-gray-400">{channel.category}</span>
            ) : <span className="text-gray-400">{channel.category}</span>}
          </span>
        </div>
      </div>

      {/* Play Button */}
      <button 
        onClick={() => onPlay(channel)}
        className="w-full bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white py-3 font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
      >
        <Play size={18} fill="currentColor" />
        تشغيل الآن
      </button>
    </div>
  );
}

// --- Channel Grid ---
export function ChannelGrid({ 
  channels, 
  onPlay, 
  favorites,
  onFavoriteToggle 
}: { 
  channels: Channel[]; 
  onPlay: (c: Channel) => void;
  favorites: string[];
  onFavoriteToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
      {channels.map(channel => (
        <ChannelCard 
          key={channel.id} 
          channel={channel} 
          onPlay={onPlay} 
          favorites={favorites}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
    </div>
  );
}

// --- Filters ---
export function CategoryFilter({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 p-4 overflow-x-auto">
      {CATEGORIES.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            active === cat.id 
              ? `bg-gradient-to-r ${cat.gradient} text-white shadow-lg` 
              : 'bg-gray-100 dark:bg-[#222] text-gray-600 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          {cat.icon === 'globe' && <Globe size={16} />}
          {cat.icon === 'star' && <Star size={16} />}
          {cat.icon === 'trophy' && <Trophy size={16} />}
          {cat.icon === 'newspaper' && <Newspaper size={16} />}
          {cat.icon === 'film' && <Film size={16} />}
          {cat.icon === 'tv' && <Tv size={16} />}
          {cat.icon === 'smile' && <Smile size={16} />}
          {cat.icon === 'baby' && <Baby size={16} />}
          {cat.icon === 'church' && <Church size={16} />}
          {cat.icon === 'music' && <Music size={16} />}
          {cat.icon === 'bookOpen' && <BookOpen size={16} />}
          {cat.icon === 'laugh' && <Laugh size={16} />}
          {cat.ar}
        </button>
      ))}
    </div>
  );
}

export function CountryFilter({ active, onChange }: { active: string; onChange: (code: string) => void }) {
  return (
    <select 
      value={active}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
    >
      <option value="">كل الدول</option>
      {COUNTRIES.map(c => (
        <option key={c.code} value={c.code}>{c.nameAr}</option>
      ))}
    </select>
  );
}

export function QualityFilter({ active, onChange }: { active: string; onChange: (q: string) => void }) {
  return (
    <select 
      value={active}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
    >
      <option value="">كل الجودات</option>
      {QUALITIES.map(q => (
        <option key={q.value} value={q.value}>{q.label}</option>
      ))}
    </select>
  );
}

export function ChannelSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="بحث بالاسم، الدولة، اللغة..."
        className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
      />
    </div>
  );
}

// --- Channel Sort ---
export function ChannelSort({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
    >
      <option value="name">حسب الاسم</option>
      <option value="country">حسب الدولة</option>
      <option value="quality">حسب الجودة</option>
      <option value="latest">الأحدث</option>
    </select>
  );
}
