const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin-legacy');

let distDir = path.resolve(__dirname, 'dist');

module.exports = [{
    name: 'demo',
    entry: [
        // 'babel-polyfill',
        './demo.ts',
    ],
    output: {
        path: distDir,
        filename: 'demo_bundle.js',
        publicPath: '/',
    },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
        rules: [
            {
                test: /webworkerscript\.ts$/,
                use: { loader:'worker-loader' },
            },
            {
                test: /\.tsx?$/,
                use: [
                    // 'babel-loader?presets[]=env',
                    {
                        loader:'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    },
                ],
            },
        ],
    },
    devServer: { contentBase: distDir },
    plugins: [new HtmlWebpackPlugin, new TerserPlugin],
    node: {
        child_process: 'empty',
        readline: 'empty',
    },
},
{
    name: 'lib',
    entry: [
        // 'babel-polyfill',
        './src/index.ts',
    ],
    output: {
        path: distDir,
        filename: 'leanBrowser.js',
        publicPath: '/',
        library: 'leanBrowser',
        libraryTarget: 'umd',
    },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
        rules: [
            {
                test: /webworkerscript\.ts$/,
                use: [
                    {
                        loader:'worker-loader',
                        options: {
                            inline: true,
                            fallback: false
                        }
                    },
                ]
            },
            {
                test: /\.tsx?$/,
                use: [
                    // 'babel-loader?presets[]=env',
                    {
                        loader:'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    },
                ],
            },
        ],
    },
    plugins: [new TerserPlugin, new CopyWebpackPlugin([
        { from: './lib_test.html', to: 'lib_test.html' },
    ])],
    node: {
        child_process: 'empty',
        readline: 'empty',
    },
},
];
