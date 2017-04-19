const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

let distDir = path.resolve(__dirname, 'dist');

module.exports = {
    entry: './demo.ts',
    output: {
        path: distDir,
        filename: 'demo_bundle.js',
        publicPath: '/',
    },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: ['babel-loader?presets[]=env', 'ts-loader'],
            },
        ],
    },
    devServer: { contentBase: distDir },
    plugins: [new HtmlWebpackPlugin],
    node: {
        child_process: 'empty',
        readline: 'empty',
    },
}