const path = require('path')
const webpack = require('webpack')
const pkg = require('./package.json')

const banner = pkg.name + ' v' + pkg.version + ' ' + pkg.homepage

module.exports = {
  entry: './src/index.ts',
  devtool: 'source-map',
  output: {
    filename: 'chobitsu.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'chobitsu',
    libraryExport: 'default',
    libraryTarget: 'umd',
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'devtools'),
      watch: false,
    },
    port: 8080,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ['ts-loader'],
      },
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'raw-loader',
            options: {
              esModule: false,
            },
          },
        ],
      },
    ],
  },
  plugins: [new webpack.BannerPlugin(banner)],
}
