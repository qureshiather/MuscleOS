export type ThemePreference = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'muscleos-site-theme';

/**
 * Runs in <head> before first paint. An explicit choice is stored and applied as
 * `data-theme`; with no stored choice the CSS follows `prefers-color-scheme`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
