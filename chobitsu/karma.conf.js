const webpackCfg = require('./webpack.config')
webpackCfg.devtool = 'inline-source-map'
webpackCfg.mode = 'development'
webpackCfg.module.rules[0].use.unshift('@jsdevtools/coverage-istanbul-loader')

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'chai'],
    files: [
      'src/index.ts',
      './test/CSS.spec.js',
      './test/Debugger.spec.js',
      './test/DOM.spec.js',
      './test/DOMDebugger.spec.js',
      './test/DOMStorage.spec.js',
      './test/Network.spec.js',
      './test/Overlay.spec.js',
      './test/Page.spec.js',
      './test/Runtime.spec.js',
      './test/Storage.spec.js',
    ],
    plugins: [
      'karma-mocha',
      'karma-chai-plugins',
      'karma-chrome-launcher',
      'karma-webpack',
      'karma-coverage-istanbul-reporter',
    ],
    webpackServer: {
      noInfo: true,
    },
    webpack: webpackCfg,
    reporters: ['progress', 'coverage-istanbul'],
    coverageIstanbulReporter: {
      reports: ['html', 'lcovonly', 'text', 'text-summary'],
    },
    preprocessors: {
      'src/index.ts': ['webpack'],
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromeHeadless'],
    singleRun: true,
    concurrency: Infinity,
  })
}
