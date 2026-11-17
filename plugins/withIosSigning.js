/**
 * Manual signing has to be set on the app target only.
 *
 * Passing PROVISIONING_PROFILE_SPECIFIER to `xcodebuild archive` applies it to
 * every target in the workspace, including Swift packages pulled in by
 * expo-iap (OpenIAP). A package target cannot carry a provisioning profile, and
 * the archive fails with:
 *
 *   OpenIAP_OpenIAP does not support provisioning profiles ... but
 *   provisioning profile X has been manually specified
 *
 * So the settings are written into the generated Xcode project for the app
 * target's build configurations, and the archive command passes none of them.
 *
 * The profile name is not committed; it comes from the CI secret through
 * DIST_PROFILE_SPECIFIER at prebuild time. Without it the plugin does nothing,
 * so a simulator-only prebuild still succeeds.
 */
const { withXcodeProject } = require('expo/config-plugins');

const BUNDLE_ID = 'com.boxledger.app';
const TEAM_ID = 'H4VQ9X6KYK';

module.exports = function withIosSigning(config) {
  return withXcodeProject(config, (cfg) => {
    const profile = process.env.DIST_PROFILE_SPECIFIER;
    if (!profile) return cfg;

    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    let patched = 0;

    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (!entry || !entry.buildSettings) continue;
      const settings = entry.buildSettings;
      const isOurTarget =
        settings.PRODUCT_BUNDLE_IDENTIFIER === BUNDLE_ID ||
        settings.PRODUCT_BUNDLE_IDENTIFIER === `"${BUNDLE_ID}"`;

      if (!isOurTarget) continue;

      settings.CODE_SIGN_STYLE = 'Manual';
      settings.CODE_SIGN_IDENTITY = 'Apple Distribution';
      settings.PROVISIONING_PROFILE_SPECIFIER = profile;
      settings.DEVELOPMENT_TEAM = TEAM_ID;
      patched += 1;
    }

    if (patched === 0) {
      throw new Error(
        `withIosSigning: no build configuration for ${BUNDLE_ID}. The generated project changed shape; signing would silently fall back to automatic.`
      );
    }

    return cfg;
  });
};
