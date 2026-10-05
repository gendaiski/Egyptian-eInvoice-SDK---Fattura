import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ar';
type Theme = 'light' | 'dark';

/**
 * Bilingual strings are colocated with the UI as L('English', 'العربية') so every
 * screen ships fully translated. A production build would extract these to ICU
 * catalogs; the call sites stay the same.
 */
interface I18n {
  lang: Lang; dir: 'ltr' | 'rtl'; theme: Theme;
  setLang(l: Lang): void; setTheme(t: Theme): void;
  L(en: string, ar: string): string;
  money(n: number, currency?: string, opts?: { compact?: boolean; sign?: boolean }): string;
  num(n: number, digits?: number): string;
  date(iso: string | undefined, style?: 'short' | 'long' | 'datetime' | 'time'): string;
  rel(iso: string): string;
}

const Ctx = createContext<I18n | null>(null);
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (read('fatura.lang') === 'ar' ? 'ar' : 'en'));
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const setLang = useCallback((l: Lang) => { write('fatura.lang', l); setLangState(l); }, []);
  const setTheme = useCallback((t: Theme) => { write('fatura.theme', t); setThemeState(t); }, []);

  const value = useMemo<I18n>(() => {
    // Latin digits in both languages: Egyptian finance teams reconcile against bank and ETA portal exports.
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
    const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, o);
    return {
      lang, dir: lang === 'ar' ? 'rtl' : 'ltr', theme, setLang, setTheme,
      L: (en, ar) => (lang === 'ar' ? ar : en),
      money: (n, currency = 'EGP', o = {}) => {
        const s = nf({ style: 'currency', currency, currencyDisplay: lang === 'ar' && currency === 'EGP' ? 'name' : 'code', notation: o.compact ? 'compact' : 'standard', maximumFractionDigits: o.compact ? 1 : 2, minimumFractionDigits: o.compact ? 0 : 2, signDisplay: o.sign ? 'exceptZero' : 'auto' }).format(n);
        return lang === 'ar' && currency === 'EGP' ? s.replace(/جنيه\S*\s+مصري\S*|جنيهات\s+مصرية/, 'ج.م') : s.replace(/ /g, ' ');
      },
      num: (n, digits = 0) => nf({ maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n),
      date: (iso, style = 'short') => {
        if (!iso) return '—';
        const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
        const o: Intl.DateTimeFormatOptions =
          style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' }
          : style === 'datetime' ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
          : style === 'time' ? { hour: '2-digit', minute: '2-digit' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
        return new Intl.DateTimeFormat(locale, o).format(d);
      },
      rel: (iso) => {
        const diff = (new Date(iso).getTime() - Date.now()) / 1000;
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        const abs = Math.abs(diff);
        if (abs < 60) return rtf.format(Math.round(diff), 'second');
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
        if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
        return rtf.format(Math.round(diff / (86400 * 30)), 'month');
      },
    };
  }, [lang, theme, setLang, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

/** Pick the right side of a bilingual record. */
export const bi = (lang: Lang, x: { en: string; ar: string }) => x[lang];
