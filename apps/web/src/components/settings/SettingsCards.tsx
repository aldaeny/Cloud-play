import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import Icon, { type IconName } from '../icons/Icon';
import {
  readPrefs, setPref, subscribePrefs, clearFavorites, clearAllLocalData,
  type Prefs, type Language,
} from '../../lib/preferences';

const DEFAULTS: Prefs = {
  language: 'ar', theme: 'dark', reduceMotion: false, textSize: 'normal', glow: true,
  autoCarousel: true, highContrast: false, solidPanels: false, hideCover: false,
  staticCover: false, playbackAuto: true, playbackMuted: false, scrollToPlayer: true,
};

function Card({ icon, title, desc, children }: { icon: IconName; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <span className="settings-card-icon" aria-hidden="true"><Icon name={icon} size={19} /></span>
        <div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
      </div>
      <div className="settings-card-body">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="settings-segmented" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className={value === o.value ? 'is-selected' : ''}
          aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function ToggleRow({ title, desc, checked, onChange }: { title: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-toggle-row">
      <span className="settings-toggle-copy"><strong>{title}</strong>{desc && <small>{desc}</small>}</span>
      <input type="checkbox" className="settings-toggle-input" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="settings-switch" aria-hidden="true"><span /></span>
    </label>
  );
}

export default function SettingsCards({ language }: { language: Language }) {
  const ar = language === 'ar';
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [confirm, setConfirm] = useState<null | 'favorites' | 'all'>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPrefs(readPrefs());
    return subscribePrefs(() => setPrefs(readPrefs()));
  }, []);

  const t = ar ? {
    language: 'اللغة', languageDesc: 'لغة الواجهة واتجاه الكتابة.',
    appearance: 'المظهر', appearanceDesc: 'السمة وحجم النص ووضوح العرض.',
    dark: 'داكن', light: 'فاتح', textSize: 'حجم النص', normal: 'عادي', large: 'كبير',
    contrast: 'تباين أوضح', contrastDesc: 'إبراز النصوص والحدود الثانوية.',
    transparency: 'تقليل الشفافية', transparencyDesc: 'خلفيات مصمتة للأقسام والقوائم.',
    motion: 'الحركة والتأثيرات', motionDesc: 'تحكّم بالأنميشن والإضاءة والعرض التلقائي.',
    reduceMotion: 'تقليل الحركة', reduceMotionDesc: 'تقليل الأنميشن والانتقالات.',
    glow: 'التوهجات المحيطة', glowDesc: 'إظهار الإضاءة والجسيمات الزخرفية.',
    autoCarousel: 'التنقل التلقائي', autoCarouselDesc: 'تغيير العنوان المختار تلقائياً.',
    hideCover: 'إخفاء صورة الغلاف', hideCoverDesc: 'عرض خلفية بسيطة في البانر.',
    staticCover: 'تثبيت صورة الغلاف', staticCoverDesc: 'إيقاف حركة الغلاف فقط.',
    playback: 'راحة المشاهدة', playbackDesc: 'تُطبّق على الفيديو التالي عند فتحه.',
    playbackAuto: 'بدء التشغيل تلقائياً', playbackAutoDesc: 'عند اختيار فيلم أو قناة.',
    playbackMuted: 'البدء بصوت مكتوم', playbackMutedDesc: 'يمكنك تشغيل الصوت من المشغّل.',
    scrollToPlayer: 'الانتقال إلى المشغّل', scrollToPlayerDesc: 'التمرير للمشغّل عند فتحه.',
    resetPlayback: 'استعادة خيارات المشاهدة الافتراضية',
    account: 'الحساب', accountDesc: 'الحساب والملف الشخصي.',
    accountStatus: 'الحساب غير مربوط', accountBody: 'تسجيل الدخول وإدارة الملف الشخصي يتوفران بعد ربط خدمة الحسابات.', signIn: 'تسجيل الدخول',
    storage: 'التخزين والبيانات', storageDesc: 'كل البيانات محفوظة على هذا الجهاز فقط.',
    clearFavorites: 'مسح المفضلة وسجل المشاهدة', clearFavoritesDesc: 'إزالة الأفلام والقنوات المحفوظة وسجل المشاهدة.',
    clearAll: 'مسح جميع البيانات المحلية', clearAllDesc: 'إعادة كل الإعدادات والبيانات إلى الوضع الافتراضي.',
    confirmFavorites: 'تأكيد مسح المفضلة وسجل المشاهدة؟', confirmAll: 'تأكيد مسح كل البيانات؟ هذا لا يمكن التراجع عنه.',
    confirm: 'تأكيد المسح', cancel: 'إلغاء',
    doneFavorites: 'تم مسح المفضلة وسجل المشاهدة.', doneAll: 'تمت إعادة التعيين إلى الوضع الافتراضي.',
    note: 'تُحفظ التفضيلات على هذا الجهاز، وتُحترم إعدادات الحركة في نظامك دائماً.',
  } : {
    language: 'Language', languageDesc: 'Interface language and text direction.',
    appearance: 'Appearance', appearanceDesc: 'Theme, text size and display clarity.',
    dark: 'Dark', light: 'Light', textSize: 'Text size', normal: 'Normal', large: 'Large',
    contrast: 'Higher contrast', contrastDesc: 'Emphasize secondary text and borders.',
    transparency: 'Reduce transparency', transparencyDesc: 'Solid surfaces for panels and menus.',
    motion: 'Motion & effects', motionDesc: 'Control animation, lighting and auto-advance.',
    reduceMotion: 'Reduce motion', reduceMotionDesc: 'Minimize animations and transitions.',
    glow: 'Ambient glow', glowDesc: 'Show decorative lights and particles.',
    autoCarousel: 'Auto-advance titles', autoCarouselDesc: 'Automatically change the featured title.',
    hideCover: 'Hide cover image', hideCoverDesc: 'Use a plain banner background.',
    staticCover: 'Still cover image', staticCoverDesc: 'Stop the cover animation only.',
    playback: 'Playback comfort', playbackDesc: 'Applied when you open the next video.',
    playbackAuto: 'Start playback automatically', playbackAutoDesc: 'When selecting a film or channel.',
    playbackMuted: 'Start muted', playbackMutedDesc: 'You can unmute in the player.',
    scrollToPlayer: 'Go to player', scrollToPlayerDesc: 'Scroll to the player when opened.',
    resetPlayback: 'Reset playback options',
    account: 'Account', accountDesc: 'Account and profile.',
    accountStatus: 'Account not connected', accountBody: 'Sign-in and profile management will be available after the account service is connected.', signIn: 'Sign in',
    storage: 'Storage & data', storageDesc: 'All data is stored on this device only.',
    clearFavorites: 'Clear favorites & watch progress', clearFavoritesDesc: 'Remove saved films, channels and watch progress.',
    clearAll: 'Clear all local data', clearAllDesc: 'Reset every preference and saved item to defaults.',
    confirmFavorites: 'Clear favorites and watch progress?', confirmAll: 'Clear all data? This cannot be undone.',
    confirm: 'Confirm clear', cancel: 'Cancel',
    doneFavorites: 'Favorites and watch progress cleared.', doneAll: 'Reset to defaults complete.',
    note: 'Preferences are saved on this device. Your system motion settings are always respected.',
  };

  const resetPlayback = () => {
    setPref('cloudplay-playback-auto', 'true');
    setPref('cloudplay-playback-muted', 'false');
    setPref('cloudplay-scroll-to-player', 'true');
  };

  const runClear = (kind: 'favorites' | 'all') => {
    const n = kind === 'favorites' ? clearFavorites() : clearAllLocalData();
    void n;
    setConfirm(null);
    setMessage(kind === 'favorites' ? t.doneFavorites : t.doneAll);
    setPrefs(readPrefs());
  };

  return (
    <div className="settings-page">
      <div className="settings-grid">
        <Card icon="globe" title={t.language} desc={t.languageDesc}>
          <Segmented label={t.language} value={prefs.language}
            options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]}
            onChange={v => setPref('cloudplay-language', v)} />
        </Card>

        <Card icon={prefs.theme === 'dark' ? 'moon' : 'sun'} title={t.appearance} desc={t.appearanceDesc}>
          <Segmented label={t.appearance} value={prefs.theme}
            options={[{ value: 'dark', label: t.dark }, { value: 'light', label: t.light }]}
            onChange={v => setPref('cloudplay-theme', v)} />
          <div className="settings-subrow">
            <span className="settings-subrow-label">{t.textSize}</span>
            <Segmented label={t.textSize} value={prefs.textSize}
              options={[{ value: 'normal', label: t.normal }, { value: 'large', label: t.large }]}
              onChange={v => setPref('cloudplay-text-size', v)} />
          </div>
          <ToggleRow title={t.contrast} desc={t.contrastDesc} checked={prefs.highContrast} onChange={v => setPref('cloudplay-high-contrast', String(v))} />
          <ToggleRow title={t.transparency} desc={t.transparencyDesc} checked={prefs.solidPanels} onChange={v => setPref('cloudplay-solid-panels', String(v))} />
        </Card>

        <Card icon="sparkle" title={t.motion} desc={t.motionDesc}>
          <ToggleRow title={t.reduceMotion} desc={t.reduceMotionDesc} checked={prefs.reduceMotion} onChange={v => setPref('cloudplay-reduce-motion', String(v))} />
          <ToggleRow title={t.glow} desc={t.glowDesc} checked={prefs.glow} onChange={v => setPref('cloudplay-glow', String(v))} />
          <ToggleRow title={t.autoCarousel} desc={t.autoCarouselDesc} checked={prefs.autoCarousel} onChange={v => setPref('cloudplay-auto-carousel', String(v))} />
          <ToggleRow title={t.hideCover} desc={t.hideCoverDesc} checked={prefs.hideCover} onChange={v => setPref('cloudplay-hide-cover', String(v))} />
          <ToggleRow title={t.staticCover} desc={t.staticCoverDesc} checked={prefs.staticCover} onChange={v => setPref('cloudplay-static-cover', String(v))} />
        </Card>

        <Card icon="play" title={t.playback} desc={t.playbackDesc}>
          <ToggleRow title={t.playbackAuto} desc={t.playbackAutoDesc} checked={prefs.playbackAuto} onChange={v => setPref('cloudplay-playback-auto', String(v))} />
          <ToggleRow title={t.playbackMuted} desc={t.playbackMutedDesc} checked={prefs.playbackMuted} onChange={v => setPref('cloudplay-playback-muted', String(v))} />
          <ToggleRow title={t.scrollToPlayer} desc={t.scrollToPlayerDesc} checked={prefs.scrollToPlayer} onChange={v => setPref('cloudplay-scroll-to-player', String(v))} />
          <button type="button" className="settings-ghost-btn" onClick={resetPlayback}>{t.resetPlayback}</button>
        </Card>

        <Card icon="user" title={t.account} desc={t.accountDesc}>
          <div className="settings-account">
            <span className="settings-account-avatar" aria-hidden="true"><Icon name="user" size={26} /></span>
            <div><strong>{t.accountStatus}</strong><p>{t.accountBody}</p></div>
          </div>
          <Link href="/login" className="settings-ghost-btn">{t.signIn}</Link>
        </Card>

        <Card icon="trash" title={t.storage} desc={t.storageDesc}>
          {message && <p className="settings-message" role="status">{message}</p>}
          {confirm === null ? (
            <div className="settings-danger-actions">
              <button type="button" className="settings-danger-btn" onClick={() => { setConfirm('favorites'); setMessage(''); }}>
                <Icon name="star" size={16} />{t.clearFavorites}
              </button>
              <button type="button" className="settings-danger-btn is-strong" onClick={() => { setConfirm('all'); setMessage(''); }}>
                <Icon name="trash" size={16} />{t.clearAll}
              </button>
            </div>
          ) : (
            <div className="settings-confirm" role="alertdialog" aria-label={confirm === 'favorites' ? t.confirmFavorites : t.confirmAll}>
              <p>{confirm === 'favorites' ? t.confirmFavorites : t.confirmAll}</p>
              <div>
                <button type="button" className="settings-danger-btn is-strong" onClick={() => runClear(confirm)}>{t.confirm}</button>
                <button type="button" className="settings-ghost-btn" onClick={() => setConfirm(null)}>{t.cancel}</button>
              </div>
            </div>
          )}
          <p className="settings-card-note">{t.note}</p>
        </Card>
      </div>
    </div>
  );
}
