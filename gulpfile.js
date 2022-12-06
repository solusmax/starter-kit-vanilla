'use strict';

const { series, parallel, src, dest, watch } = require('gulp');
const autoprefixer     = require('autoprefixer');
const browserSync      = require('browser-sync').create();
const cssnano          = require('cssnano');
const del              = require('del');
const fileinclude      = require('gulp-file-include');
const ghPages          = require('gh-pages');
const gulpIf           = require('gulp-if');
const gulpWebpack      = require('webpack-stream');
const htmlmin          = require('gulp-htmlmin');
const imagemin         = require('gulp-imagemin');
const inlineSvg        = require('postcss-inline-svg');
const magicImporter    = require('node-sass-magic-importer');
const newer            = require('gulp-newer');
const plumber          = require('gulp-plumber');
const postcss          = require('gulp-postcss');
const postcssNormalize = require('postcss-normalize');
const rename           = require('gulp-rename');
const sass             = require('gulp-sass')(require('sass'));
const svgstore         = require('gulp-svgstore');
const webp             = require('gulp-webp');
const webpack          = require('webpack');

// **************************** ФАЙЛОВАЯ СТРУКТУРА *****************************

const SRC_PATH = './src';
const BUILD_PATH = './build';

const SrcPaths = {
  HTML: `${SRC_PATH}/html`,
  SCSS: `${SRC_PATH}/scss`,
  JS: `${SRC_PATH}/js`,
  IMG: `${SRC_PATH}/img`,
  FONTS: `${SRC_PATH}/fonts`,
  FAVICON: `${SRC_PATH}/favicon`
};

const SCSS_ENTRY_POINT = `${SrcPaths.SCSS}/style.scss`;
const JS_ENTRY_POINT = `./${SrcPaths.JS}/main.js`;

const SrcFiles = {
  HTML: [`${SrcPaths.HTML}/**/*.html`],
  SCSS: [`${SrcPaths.SCSS}/**/*.scss`],
  JS: [`${SrcPaths.JS}/**/*.js`],
  IMG: [`${SrcPaths.IMG}/**/*.{jpg,jpeg,png,gif,svg}`],
  IMG_TO_WEBP: [`${SrcPaths.IMG}/**/*.{jpg,jpeg,png}`],
  SVG: [`${SrcPaths.IMG}/**/*.svg`],
  SVG_TO_SPRITE: [`${SrcPaths.IMG}/**/icon-*.svg`],
  FONTS: [`${SrcPaths.FONTS}/**/*`],
  FAVICON: [`${SrcPaths.FAVICON}/**/*`]
}

const BuildPaths = {
  HTML: `${BUILD_PATH}`,
  CSS: `${BUILD_PATH}/css`,
  JS: `${BUILD_PATH}/js`,
  IMG: `${BUILD_PATH}/img`,
  FONTS: `${BUILD_PATH}/fonts`,
  FAVICON: `${BUILD_PATH}`
};

const CSS_BUNDLE_FILENAME = 'style.min.css';
const JS_BUNDLE_FILENAME = 'script.min.js';
const SVG_SPRITE_FILENAME = 'sprite.svg';

// ************************* ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ***************************

let isProductionMode = false;

// Включение режима продакшена

const enableProductionMode = (cb) => {
  isProductionMode = true;
  cb();
};

// Перезагрузка страницы в браузере

const reloadPage = (cb) => {
  browserSync.reload();
  cb();
};

// Удаление папки build

const clearBuildForlder = () => {
  return del(`${BUILD_PATH}`, {
    force: true
  });
};

// Публикация на GitHub Pages

const publishGhPages = (cb) => {
  ghPages.publish(`${BUILD_PATH}/`, cb);
}

// ******************************** СБОРКА *************************************

// HTML

const buildHtml = () => {
  return src(SrcFiles.HTML)
    .pipe(fileinclude({
      prefix: '@@',
      basepath: '@root'
    }))
    .pipe(htmlmin({
      caseSensitive: true,
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true
    }))
    .pipe(dest(`${BuildPaths.HTML}`));
}

exports.buildHtml = series(buildHtml);

// CSS

const buildCss = () => {
  return src(SCSS_ENTRY_POINT, { sourcemaps: !isProductionMode })
    .pipe(gulpIf(!isProductionMode, plumber()))
    .pipe(sass({
      importer: magicImporter()
    }).on('error', sass.logError))
    .pipe(postcss([
      inlineSvg({
        paths: ['.']
      }),
      postcssNormalize({
        forceImport: 'normalize.css'
      }),
      autoprefixer()
    ]))
    .pipe(gulpIf(isProductionMode, postcss([
      cssnano()
    ])))
    .pipe(rename(CSS_BUNDLE_FILENAME))
    .pipe(dest(`${BuildPaths.CSS}`, { sourcemaps: '.' }));
};

exports.buildCss = series(buildCss);

// JS

const buildJs = () => {
  return src(JS_ENTRY_POINT, { sourcemaps: !isProductionMode })
    .pipe(gulpIf(!isProductionMode, plumber()))
    .pipe(gulpWebpack({
      mode: isProductionMode ? 'production' : 'development',
      entry: JS_ENTRY_POINT,
      output: {
        filename: JS_BUNDLE_FILENAME,
      },
      devtool: isProductionMode ? false : 'source-map',
      module: {
        rules: [
          {
            test: /\.(js)$/,
            exclude: /(node_modules)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env']
              }
            }
          }
        ]
      }
    }, webpack))
    .pipe(dest(`${BuildPaths.JS}`, { sourcemaps: '.' }));
};

exports.buildJs = series(buildJs);

// Изображения

const buildImg = () => {
  return src(SrcFiles.IMG, { base: `${SrcPaths.IMG}` })
    .pipe(gulpIf(!isProductionMode, plumber()))
    .pipe(gulpIf(!isProductionMode, newer(`${BuildPaths.IMG}`)))
    .pipe(gulpIf(isProductionMode, imagemin([
      imagemin.mozjpeg({
        quality: 90,
        progressive: true
      }),
      imagemin.optipng({
        optimizationLevel: 3
      }),
      imagemin.svgo(),
      imagemin.gifsicle()
    ])))
    .pipe(dest(`${BuildPaths.IMG}`));
};

exports.buildImg = series(buildImg);

// WebP

const buildWebp = () => {
  return src(SrcFiles.IMG_TO_WEBP, { base: `${SrcPaths.IMG}` })
    .pipe(gulpIf(!isProductionMode, plumber()))
    .pipe(webp({
      quality: 90
    }))
    .pipe(dest(`${BuildPaths.IMG}`));
};

exports.buildWebp = series(buildWebp);

// SVG-спрайт

const buildSvgSprite = () => {
  return src(SrcFiles.SVG_TO_SPRITE)
    .pipe(imagemin([
      imagemin.svgo({
        plugins: [{
          cleanupIDs: true
        }]
      })
    ]))
    .pipe(svgstore({
      inlineSvg: true
    }))
    .pipe(rename(SVG_SPRITE_FILENAME))
    .pipe(dest(`${BuildPaths.IMG}`));
}

exports.buildSvgSprite = series(buildSvgSprite);

// Шрифты

const buildFonts = () => {
  return src(SrcFiles.FONTS)
    .pipe(dest(`${BuildPaths.FONTS}`));
};

exports.buildFonts = series(buildFonts);

// Фавиконки

const buildFavicon = () => {
  return src(SrcFiles.FAVICON)
    .pipe(gulpIf(isProductionMode, imagemin([
      imagemin.optipng({
        optimizationLevel: 3
      }),
      imagemin.svgo()
    ])))
    .pipe(dest(`${BuildPaths.FAVICON}`));
};

exports.buildFavicon = series(buildFavicon);

// ***************************** ЛОКАЛЬНЫЙ СЕРВЕР ******************************

const startServer = () => {
  browserSync.init({
    server: `${BUILD_PATH}`,
    cors: true,
    notify: false,
    injectChanges: false,
    ghostMode: {
      clicks: false,
      forms: false,
      scroll: false
    }
  });

  // Вотчеры

  watch(
    [...SrcFiles.HTML, ...SrcFiles.SVG_TO_SPRITE],
    series(buildSvgSprite, buildHtml, reloadPage)
  );

  watch(
    [...SrcFiles.SCSS, ...SrcFiles.SVG],
    series(buildCss, reloadPage)
  );

  watch(
    SrcFiles.JS,
    series(buildJs, reloadPage)
  );

  watch(
    SrcFiles.IMG,
    series(buildImg, reloadPage)
  );

  watch(
    SrcFiles.IMG_TO_WEBP,
    series(buildWebp, reloadPage)
  );

  watch(
    SrcFiles.FONTS,
    series(buildFonts, reloadPage)
  );

  watch(
    SrcFiles.FAVICON,
    series(buildFavicon, reloadPage)
  );
};

// ********************************** ЗАДАЧИ ***********************************

// Задачи

const buildDev = series(
  clearBuildForlder,
  parallel(
    series(buildSvgSprite, buildHtml),
    buildCss,
    buildJs,
    buildImg,
    buildWebp,
    buildFonts,
    buildFavicon
  )
);
const buildProd = series(enableProductionMode, buildDev);
const startDev = series(buildDev, startServer);
const deployGhPages = series(buildProd, publishGhPages);

exports.default = startDev;
exports.buildProd = buildProd;
exports.buildDev = buildDev;
exports.deployGhPages = deployGhPages;
