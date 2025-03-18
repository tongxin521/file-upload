import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url)

const postcss = require('rollup-plugin-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

const __dirname = dirname(fileURLToPath(import.meta.url));
export default {
    input: resolve(__dirname, 'src/index.js'),
    output: {
        file: resolve(__dirname, '../server/public/index.js'),
        format: 'es',
    },
    plugins: [
        postcss({
            plugins: [
                autoprefixer(),
                cssnano({
                    preset: 'default',
                }),
            ],
            extract: true,
            inject: false,
        }),
    ],
}