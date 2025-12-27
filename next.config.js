/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize Puppeteer and related packages to prevent bundling issues
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'puppeteer',
      'puppeteer-core',
      'puppeteer-extra',
      'puppeteer-extra-plugin',
      'puppeteer-extra-plugin-stealth',
      'clone-deep',
      'merge-deep',
    ],
  },
  // Disable webpack bundling for these packages
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'puppeteer': 'commonjs puppeteer',
        'puppeteer-core': 'commonjs puppeteer-core',
        'puppeteer-extra': 'commonjs puppeteer-extra',
        'puppeteer-extra-plugin': 'commonjs puppeteer-extra-plugin',
        'puppeteer-extra-plugin-stealth': 'commonjs puppeteer-extra-plugin-stealth',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
