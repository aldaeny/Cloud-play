'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Tv, Search, Star, Globe, Trophy, Newspaper, Film, Play, Smile, Baby, Church, Music, BookOpen, Laugh } from 'lucide-react';
import type { Channel } from '../../types/channel';
import { CATEGORIES, QUALITIES } from '../../constants/categories';
import { countryLabel } from '../../lib/iptv-country';

type CardProps = { channel: Channel; onPlay: (channel: Channel) => void; favorites: string[]; onFavoriteToggle: (id: string) => void };
export function ChannelCard({ channel, onPlay, favorites, onFavoriteToggle }: CardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const isFavorite = favorites.includes(channel.id);
  const quality = QUALITIES.find(item => item.value === channel.quality);
  const category = CATEGORIES.find(item => item.id === channel.category);
  return <article className="live-card" data-channel-id={channel.id}>
    <div className="live-card-art">
      {channel.logo && !logoFailed ? <Image src={channel.logo} alt="" width={240} height={135} loading="lazy" unoptimized referrerPolicy="no-referrer" onError={() => setLogoFailed(true)}/> : <Tv size={42} aria-hidden="true" opacity={.45}/>}
      <div className="live-card-badges"><span className={`live-badge${channel.isLive ? ' live-badge-live' : ''}`}>{channel.isLive ? 'LIVE' : 'غير متاح'}</span>{quality && <span className="live-badge">{quality.label}</span>}</div>
    </div>
    <button type="button" className="live-card-fav" aria-pressed={isFavorite} aria-label={`${isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}: ${channel.name}`} onClick={() => onFavoriteToggle(channel.id)}><Star size={18} fill={isFavorite ? 'currentColor' : 'none'}/></button>
    <div className="live-card-info"><h3 title={channel.name}>{channel.name}</h3><div className="live-card-meta"><Globe size={12} aria-hidden="true"/><span>{channel.countryCode ? `${channel.countryCode} · ${channel.country}` : 'دولة غير محددة'}</span><span>· {category?.ar ?? channel.sourceGroup}</span></div></div>
    <button type="button" className="live-card-play" disabled={!channel.playable} onClick={() => onPlay(channel)} aria-label={`${channel.playable ? 'تشغيل' : 'قناة غير متاحة'}: ${channel.name}`}><Play size={16}/>{channel.playable ? 'تشغيل الآن' : 'المصدر غير متاح'}</button>
  </article>;
}
export function ChannelGrid(props: { channels: Channel[] } & Omit<CardProps, 'channel'>) {
  return <div className="live-grid">{props.channels.map(channel => <ChannelCard key={channel.id} channel={channel} onPlay={props.onPlay} favorites={props.favorites} onFavoriteToggle={props.onFavoriteToggle}/>)}</div>;
}
const icons = { globe: Globe, star: Star, trophy: Trophy, newspaper: Newspaper, film: Film, tv: Tv, smile: Smile, baby: Baby, church: Church, music: Music, bookOpen: BookOpen, laugh: Laugh };
export function CategoryFilter({ active, onChange, language = 'ar' }: { active: string; onChange: (id: string) => void; language?: 'ar' | 'en' }) {
  return <div className="live-categories" role="group" aria-label={language === 'ar' ? 'تصنيف القنوات' : 'Channel categories'}>{CATEGORIES.map(category => {
    const Icon = icons[category.icon as keyof typeof icons] ?? Tv;
    return <button type="button" key={category.id} className="live-chip" aria-pressed={active === category.id} onClick={() => onChange(category.id)}><Icon size={16} aria-hidden="true"/>{category[language]}</button>;
  })}</div>;
}
export function CountryFilter({ active, onChange, channels, language = 'ar' }: { active: string; onChange: (code: string) => void; channels: Channel[]; language?: 'ar' | 'en' }) {
  const codes = [...new Set(channels.map(channel => channel.countryCode || 'OTHER'))].sort((a, b) => countryLabel(a, language === 'ar').localeCompare(countryLabel(b, language === 'ar')));
  return <label className="live-select-label">{language === 'ar' ? 'الدولة' : 'Country'}<select value={active} onChange={event => onChange(event.target.value)}><option value="">{language === 'ar' ? 'كل الدول' : 'All countries'}</option>{codes.map(code => <option key={code} value={code}>{countryLabel(code, language === 'ar')}</option>)}</select></label>;
}
export function QualityFilter({ active, onChange, language = 'ar' }: { active: string; onChange: (quality: string) => void; language?: 'ar' | 'en' }) {
  return <label className="live-select-label">{language === 'ar' ? 'الجودة المعلنة' : 'Declared quality'}<select value={active} onChange={event => onChange(event.target.value)}><option value="">{language === 'ar' ? 'كل الجودات' : 'All qualities'}</option>{QUALITIES.map(quality => <option key={quality.value} value={quality.value}>{quality.label}</option>)}<option value="unknown">{language === 'ar' ? 'غير محددة من المصدر' : 'Not declared'}</option></select></label>;
}
export function ChannelSearch({ value, onChange, language = 'ar' }: { value: string; onChange: (value: string) => void; language?: 'ar' | 'en' }) {
  const label = language === 'ar' ? 'بحث بالاسم، الدولة، اللغة أو التصنيف' : 'Search name, country, language or category';
  return <div className="live-search"><Search size={18} aria-hidden="true"/><input type="search" value={value} maxLength={100} onChange={event => onChange(event.target.value)} placeholder={label} aria-label={label}/></div>;
}
export function ChannelSort({ value, onChange, language = 'ar' }: { value: string; onChange: (value: string) => void; language?: 'ar' | 'en' }) {
  const ar = language === 'ar';
  return <label className="live-select-label">{ar ? 'الترتيب' : 'Sort'}<select value={value} onChange={event => onChange(event.target.value)}><option value="name">{ar ? 'حسب الاسم' : 'Name'}</option><option value="country">{ar ? 'حسب الدولة' : 'Country'}</option><option value="quality">{ar ? 'الجودة الأعلى أولاً' : 'Highest declared quality'}</option><option value="category">{ar ? 'حسب التصنيف' : 'Category'}</option></select></label>;
}
