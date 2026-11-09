import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAccount } from './AccountProvider';
import type { Language } from '../../lib/preferences';
import Icon from '../icons/Icon';

type Mode = 'signin' | 'signup' | 'reset' | 'newPassword';

function friendlyError(message: string, ar: boolean): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return ar ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.';
  if (m.includes('already registered') || m.includes('already been registered')) return ar ? 'هذا البريد مسجّل مسبقاً. جرّب تسجيل الدخول.' : 'This email is already registered. Try signing in.';
  if (m.includes('password')) return ar ? 'كلمة المرور قصيرة جداً (6 أحرف على الأقل).' : 'Password is too short (at least 6 characters).';
  if (m.includes('email')) return ar ? 'أدخل بريداً إلكترونياً صحيحاً.' : 'Enter a valid email address.';
  if (m.includes('rate limit')) return ar ? 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.' : 'Too many attempts. Please wait a moment and try again.';
  return ar ? 'تعذّر إكمال الطلب. تحقق من الاتصال وحاول مجدداً.' : 'Could not complete the request. Check your connection and try again.';
}

export default function AccountPanel({ language }: { language: Language }) {
  const ar = language === 'ar';
  const { configured, loading, user, syncState, signIn, signUp, signOut, resetPassword, recoveryActive, updatePassword } = useAccount();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // A recovery link grants a temporary session. Ask for the new password BEFORE
  // rendering the signed-in view, otherwise the user is stuck signed in with no
  // way to change the password they just reset.
  const showNewPassword = recoveryActive || mode === 'newPassword';

  const t = ar ? {
    title: 'حساب مجاني',
    subtitle: 'أنشئ حساباً مجانياً لحفظ مفضلتك وتقدّم المشاهدة عبر أجهزتك. بدون دفع أو اشتراك.',
    signin: 'تسجيل الدخول', signup: 'إنشاء حساب', reset: 'استعادة كلمة المرور',
    email: 'البريد الإلكتروني', password: 'كلمة المرور',
    submitSignin: 'دخول', submitSignup: 'إنشاء الحساب مجاناً', submitReset: 'إرسال رابط الاستعادة',
    forgot: 'نسيت كلمة المرور؟', back: 'العودة لتسجيل الدخول',
    signedInAs: 'مسجّل الدخول باسم', signOut: 'تسجيل الخروج',
    syncIdle: 'المزامنة جاهزة', syncSyncing: 'جارٍ المزامنة…', syncSynced: 'تمت المزامنة', syncError: 'تعذّرت المزامنة حالياً',
    notConfigured: 'خدمة الحسابات غير مفعّلة على هذا النشر بعد.',
    loading: 'جارٍ التحقق من الحساب…',
    resetSent: 'إذا كان البريد مسجلاً، ستصلك رسالة استعادة كلمة المرور.',
    newPassword: 'تعيين كلمة مرور جديدة',
    newPasswordHint: 'اختر كلمة مرور جديدة لإكمال استعادة حسابك.',
    submitNewPassword: 'حفظ كلمة المرور',
    newPasswordDone: 'تم تحديث كلمة المرور بنجاح.',
    continue: 'متابعة التصفح',
    free: 'مجاني بالكامل',
  } : {
    title: 'Free account',
    subtitle: 'Create a free account to keep your favorites and watch progress across devices. No payment, no subscription.',
    signin: 'Sign in', signup: 'Create account', reset: 'Reset password',
    email: 'Email', password: 'Password',
    submitSignin: 'Sign in', submitSignup: 'Create free account', submitReset: 'Send reset link',
    forgot: 'Forgot password?', back: 'Back to sign in',
    signedInAs: 'Signed in as', signOut: 'Sign out',
    syncIdle: 'Sync ready', syncSyncing: 'Syncing…', syncSynced: 'Synced', syncError: 'Sync is temporarily unavailable',
    notConfigured: 'Accounts are not enabled on this deployment yet.',
    loading: 'Checking your account…',
    resetSent: 'If that email is registered, a password reset message is on its way.',
    newPassword: 'Set a new password',
    newPasswordHint: 'Choose a new password to finish recovering your account.',
    submitNewPassword: 'Save password',
    newPasswordDone: 'Your password has been updated.',
    continue: 'Continue browsing',
    free: 'Completely free',
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setMessage('');
    // Recovery is identified by the session Supabase created from the link, so
    // it needs only the new password — no email, and no re-authentication.
    if (showNewPassword) {
      if (password.length < 6) {
        setError(ar ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' : 'Password must be at least 6 characters.');
        return;
      }
      setBusy(true);
      try {
        await updatePassword(password);
        setPassword('');
        setMode('signin');
        setMessage(t.newPasswordDone);
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : String(err), ar));
      } finally {
        setBusy(false);
      }
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError(ar ? 'أدخل بريداً إلكترونياً صحيحاً.' : 'Enter a valid email address.');
      return;
    }
    if (mode !== 'reset' && password.length < 6) {
      setError(ar ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' : 'Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(cleanEmail, password);
      else if (mode === 'signup') await signUp(cleanEmail, password);
      else {
        await resetPassword(cleanEmail);
        setMessage(t.resetSent);
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err), ar));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true); setError('');
    try { await signOut(); } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err), ar));
    } finally { setBusy(false); }
  }

  if (!configured) {
    return (
      <div className="account-panel">
        <section className="settings-card account-card">
          <div className="settings-card-head">
            <span className="settings-card-icon" aria-hidden="true"><Icon name="user" size={19} /></span>
            <div><h2>{t.title}</h2><p>{t.notConfigured}</p></div>
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return <div className="account-panel"><p className="firebase-note" role="status">{t.loading}</p></div>;
  }

  if (user && !showNewPassword) {
    const syncLabel = syncState === 'syncing' ? t.syncSyncing : syncState === 'synced' ? t.syncSynced : syncState === 'error' ? t.syncError : t.syncIdle;
    return (
      <div className="account-panel">
        <section className="settings-card account-card">
          <div className="settings-card-head">
            <span className="settings-card-icon" aria-hidden="true"><Icon name="user" size={19} /></span>
            <div><h2>{t.title}</h2><p>{t.subtitle}</p></div>
          </div>
          <div className="settings-card-body">
            <div className="settings-account">
              <span className="settings-account-avatar" aria-hidden="true"><Icon name="user" size={26} /></span>
              <div>
                <strong>{t.signedInAs}</strong>
                <p className="account-email">{user.email}</p>
              </div>
            </div>
            <p className={`account-sync account-sync-${syncState}`} role="status">{syncLabel}</p>
            <div className="account-actions">
              <button type="button" className="settings-ghost-btn" onClick={handleSignOut} disabled={busy}>{t.signOut}</button>
              <Link href="/movies" className="settings-ghost-btn">{t.continue}</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="account-panel">
      <section className="settings-card account-card">
        <div className="settings-card-head">
          <span className="settings-card-icon" aria-hidden="true"><Icon name="user" size={19} /></span>
          <div>
            <h2>{showNewPassword ? t.newPassword : mode === 'signup' ? t.signup : mode === 'reset' ? t.reset : t.signin}</h2>
            <p>{showNewPassword ? t.newPasswordHint : t.subtitle}</p>
          </div>
        </div>
        <div className="settings-card-body">
          {!showNewPassword && <span className="account-free-badge">{t.free}</span>}
          {error && <p className="account-error" role="alert">{error}</p>}
          {message && <p className="settings-message" role="status">{message}</p>}
          {/* noValidate: use the app's bilingual, screen-reader-friendly error
              messages instead of the browser's native validation bubbles. */}
          <form className="account-form" onSubmit={handleSubmit} noValidate>
            {!showNewPassword && (
              <label className="account-field">
                <span>{t.email}</span>
                <input
                  type="email" autoComplete="email" inputMode="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com" dir="ltr"
                />
              </label>
            )}
            {(mode !== 'reset' || showNewPassword) && (
              <label className="account-field">
                <span>{t.password}</span>
                <input
                  type="password" autoComplete={mode === 'signup' || showNewPassword ? 'new-password' : 'current-password'}
                  required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  dir="ltr"
                />
              </label>
            )}
            <button type="submit" className="account-submit" disabled={busy}>
              {busy ? '…' : showNewPassword ? t.submitNewPassword : mode === 'signup' ? t.submitSignup : mode === 'reset' ? t.submitReset : t.submitSignin}
            </button>
          </form>
          <div className="account-links">
            {!showNewPassword && mode === 'signin' && (
              <>
                <button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>{t.signup}</button>
                <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>{t.forgot}</button>
              </>
            )}
            {!showNewPassword && mode === 'signup' && (
              <button type="button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>{t.signin}</button>
            )}
            {!showNewPassword && mode === 'reset' && (
              <button type="button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>{t.back}</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
