const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

function withCleartextTraffic(config) {
  config = withAndroidManifest(config, (cfg) => {
    const modResults = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(modResults);
    app.$['android:usesCleartextTraffic'] = 'true';
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const resXmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.writeFileSync(path.join(resXmlDir, 'network_security_config.xml'), NETWORK_SECURITY_CONFIG_XML);
      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      if (!cfg.ios.infoPlist) cfg.ios.infoPlist = {};
      cfg.ios.infoPlist.NSAppTransportSecurity = {
        NSAllowsArbitraryLoads: true,
      };
      return cfg;
    },
  ]);

  return config;
}

module.exports = withCleartextTraffic;
