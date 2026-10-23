const { withAndroidStyles, withMainActivity } = require('expo/config-plugins');

const CONFIG_IMPORT = 'import android.content.res.Configuration';
const INSETS_IMPORT = 'import androidx.core.view.WindowInsetsControllerCompat';
const IMPORT_ANCHOR = 'import android.os.Bundle';
const ON_CREATE_ANCHOR = '    super.onCreate(null)\n';

const METHODS = `
  /**
   * MUS-168: the navigation bar's buttons follow the app's theme, which JS sets with
   * Appearance.setColorScheme (AppCompat night mode). Contrast enforcement is off in the theme, so
   * without this a dark app on a light phone kept dark buttons over a white scrim.
   */
  private fun applyNavigationBarAppearance(config: Configuration) {
    val night = (config.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = !night
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyNavigationBarAppearance(newConfig)
  }
`;

function withMainActivityAppearance(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error(
        `withNavigationBarFollowsAppTheme expects a Kotlin MainActivity, got "${cfg.modResults.language}"`
      );
    }
    let contents = cfg.modResults.contents;
    if (contents.includes('applyNavigationBarAppearance')) return cfg;
    if (!contents.includes(IMPORT_ANCHOR) || !contents.includes(ON_CREATE_ANCHOR)) {
      throw new Error('withNavigationBarFollowsAppTheme could not find its anchors in MainActivity');
    }
    for (const line of [CONFIG_IMPORT, INSETS_IMPORT]) {
      if (!contents.includes(line)) contents = contents.replace(IMPORT_ANCHOR, `${line}\n${IMPORT_ANCHOR}`);
    }
    contents = contents.replace(
      ON_CREATE_ANCHOR,
      `${ON_CREATE_ANCHOR}    applyNavigationBarAppearance(resources.configuration)\n`
    );
    const classEnd = contents.lastIndexOf('}');
    cfg.modResults.contents = contents.slice(0, classEnd) + METHODS + contents.slice(classEnd);
    return cfg;
  });
}

function withNoNavigationBarScrim(config) {
  return withAndroidStyles(config, (cfg) => {
    const appTheme = cfg.modResults.resources.style?.find((s) => s.$.name === 'AppTheme');
    if (!appTheme) throw new Error('withNavigationBarFollowsAppTheme could not find AppTheme');
    appTheme.item = appTheme.item ?? [];
    for (const name of ['android:enforceNavigationBarContrast', 'android:enforceStatusBarContrast']) {
      if (!appTheme.item.some((i) => i.$.name === name)) {
        appTheme.item.push({ _: 'false', $: { name, 'tools:targetApi': '29' } });
      }
    }
    return cfg;
  });
}

/**
 * Android 3-button navigation: no white contrast scrim behind the buttons, and button colours that
 * match the app's theme rather than the phone's (docs/features/accounts-and-data.md#settings).
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
module.exports = function withNavigationBarFollowsAppTheme(config) {
  return withNoNavigationBarScrim(withMainActivityAppearance(config));
};
