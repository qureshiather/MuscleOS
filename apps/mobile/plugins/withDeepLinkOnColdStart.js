const { withMainActivity } = require('expo/config-plugins');

const INTENT_IMPORT = 'import android.content.Intent';
const IMPORT_ANCHOR = 'import android.os.Bundle';

const OVERRIDE = `
  /**
   * React Native discards an intent that arrives before the JS context exists, which is
   * exactly what happens when tapping a notification relaunches an app the OS had killed.
   * Recording it on the activity keeps Linking.getInitialURL() working so expo-router can
   * still route to the deep link once JS boots.
   */
  override fun onNewIntent(intent: Intent) {
    setIntent(intent)
    super.onNewIntent(intent)
  }
`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withDeepLinkOnColdStart(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error(
        `withDeepLinkOnColdStart expects a Kotlin MainActivity, got "${cfg.modResults.language}"`
      );
    }

    let contents = cfg.modResults.contents;
    if (contents.includes('override fun onNewIntent')) return cfg;

    if (!contents.includes(INTENT_IMPORT)) {
      if (!contents.includes(IMPORT_ANCHOR)) {
        throw new Error('withDeepLinkOnColdStart could not find an import anchor in MainActivity');
      }
      contents = contents.replace(IMPORT_ANCHOR, `${INTENT_IMPORT}\n${IMPORT_ANCHOR}`);
    }

    const classEnd = contents.lastIndexOf('}');
    if (classEnd === -1) {
      throw new Error('withDeepLinkOnColdStart could not find the MainActivity class body');
    }
    cfg.modResults.contents = contents.slice(0, classEnd) + OVERRIDE + contents.slice(classEnd);
    return cfg;
  });
};
