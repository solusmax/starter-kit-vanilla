import { deleteAsync } from 'del';
import { publish } from 'gh-pages';
import * as dartSass from 'sass';
import autoprefixer from 'autoprefixer';
import browserSync from 'browser-sync';
import cssnano from 'cssnano';
import fileinclude from 'gulp-file-include';
import gulp from 'gulp';
import gulpIf from 'gulp-if';
import gulpSass from 'gulp-sass';
import gulpWebpack from 'webpack-stream';
import htmlmin from 'gulp-htmlmin';
import imagemin, { mozjpeg, optipng, svgo, gifsicle } from 'gulp-imagemin';
import inlineSvg from 'postcss-inline-svg';
import magicImporter from 'node-sass-magic-importer';
import newer from 'gulp-newer';
import plumber from 'gulp-plumber';
import postcss from 'gulp-postcss';
import rename from 'gulp-rename';
import rev from 'gulp-rev';
import revRewrite from 'gulp-rev-rewrite';
import revDel from 'gulp-rev-delete-original';
import svgstore from 'gulp-svgstore';
import webp from 'gulp-webp';
import webpack from 'webpack';

const { series, parallel, src, dest, watch } = gulp;
const sass = gulpSass(dartSass);
const server = browserSync.create();

// ****************************** FILE STRUCTURE *******************************

const SRC_PATH = './src';
const BUILD_PATH = './build';

const SrcPath = {
  HTML: `${SRC_PATH}/html`,
  SCSS: `${SRC_PATH}/scss`,
  JS: `${SRC_PATH}/js`,
  IMG: `${SRC_PATH}/img`,
  FONTS: `${SRC_PATH}/fonts`,
  FAVICON: `${SRC_PATH}/favicon`,
};

const SCSS_ENTRY_POINT = `${SrcPath.SCSS}/style.scss`;
const JS_ENTRY_POINT = `./${SrcPath.JS}/main.js`;

const SrcFiles = {
  HTML: [`${SrcPath.HTML}/**/*.html`, `!${SrcPath.HTML}/includes/**/*.html`],
  SCSS: [`${SrcPath.SCSS}/**/*.scss`],
  JS: [`${SrcPath.JS}/**/*.js`],
  IMG: [`${SrcPath.IMG}/**/*.{jpg,jpeg,png,gif,svg}`],
  IMG_TO_WEBP: [`${SrcPath.IMG}/**/*.{jpg,jpeg,png}`],
  SVG: [`${SrcPath.IMG}/**/*.svg`],
  SVG_TO_SPRITE: [`${SrcPath.IMG}/**/icon-*.svg`],
  FONTS: [`${SrcPath.FONTS}/**/*`],
  FAVICON: [`${SrcPath.FAVICON}/**/*`],
};

const BuildPath = {
  HTML: `${BUILD_PATH}`,
  CSS: `${BUILD_PATH}/css`,
  JS: `${BUILD_PATH}/js`,
  IMG: `${BUILD_PATH}/img`,
  FONTS: `${BUILD_PATH}/fonts`,
  FAVICON: `${BUILD_PATH}`,
};

const CSS_BUNDLE_FILENAME = 'style.min.css';
const JS_BUNDLE_FILENAME = 'script.min.js';
const SVG_SPRITE_FILENAME = 'sprite.svg';

// **************************** UTILITY FUNCTIONS ******************************

let isProductionMode = false;

const enableProductionMode = (cb) => {
  isProductionMode = true;
  cb();
};

const reloadPage = (cb) => {
  server.reload();
  cb();
};

const clearBuildFolder = () => {
  return deleteAsync(`${BUILD_PATH}`, {
    force: true,
  });
};

const publishGhPages = (cb) => {
  publish(`${BUILD_PATH}/`, cb);
};

const bustCache = () => {
  return src(
    [
      `${BuildPath.CSS}/${CSS_BUNDLE_FILENAME}`,
      `${BuildPath.JS}/${JS_BUNDLE_FILENAME}`,
    ],
    { base: BUILD_PATH },
  )
    .pipe(rev())
    .pipe(revDel())
    .pipe(src(`${BuildPath.HTML}/**/*.html`))
    .pipe(revRewrite())
    .pipe(dest(BuildPath.HTML));
};

// ********************************* BUILDERS **********************************

// HTML

const buildHtml = () => {
  return src(SrcFiles.HTML)
    .pipe(
      fileinclude({
        prefix: '@@',
        basepath: '@root',
      }),
    )
    .pipe(
      htmlmin({
        caseSensitive: true,
        collapseWhitespace: true,
        conservativeCollapse: true,
        removeComments: true,
      }),
    )
    .pipe(dest(`${BuildPath.HTML}`));
};

const _buildHtml = series(buildHtml);
export { _buildHtml as buildHtml };

// CSS

const buildCss = () => {
  return src(SCSS_ENTRY_POINT, { sourcemaps: !isProductionMode })
    .pipe(gulpIf(!isProductionMode, plumber()))
    .pipe(
      sass({
        importer: magicImporter(),
      }).on('error', sass.logError),
    )
    .pipe(
      postcss([
        inlineSvg({
          paths: ['.'],
        }),
        autoprefixer(),
      ]),
    )
    .pipe(gulpIf(isProductionMode, postcss([cssnano()])))
    .pipe(rename(CSS_BUNDLE_FILENAME))
    .pipe(dest(`${BuildPath.CSS}`, { sourcemaps: '.' }));
};

const _buildCss = series(buildCss);
export { _buildCss as buildCss };

// JS

const buildJs = () => {
  return (
    src(JS_ENTRY_POINT, { sourcemaps: !isProductionMode })
      .pipe(gulpIf(!isProductionMode, plumber()))

      // Webpack config

      .pipe(
        gulpWebpack(
          {
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
                      presets: ['@babel/preset-env'],
                    },
                  },
                },
              ],
            },
          },
          webpack,
        ),
      )

      .pipe(dest(`${BuildPath.JS}`, { sourcemaps: '.' }))
  );
};

const _buildJs = series(buildJs);
export { _buildJs as buildJs };

// Images

const buildImg = () => {
  return src(SrcFiles.IMG, { base: `${SrcPath.IMG}` })
    .pipe(gulpIf(!isProductionMode, plumber()))
    .pipe(gulpIf(!isProductionMode, newer(`${BuildPath.IMG}`)))
    .pipe(
      gulpIf(
        isProductionMode,
        imagemin([
          mozjpeg({
            quality: 90,
            progressive: true,
          }),
          optipng({
            optimizationLevel: 3,
          }),
          svgo(),
          gifsicle(),
        ]),
      ),
    )
    .pipe(dest(`${BuildPath.IMG}`));
};

const _buildImg = series(buildImg);
export { _buildImg as buildImg };

// WebP

const buildWebp = () => {
  return src(SrcFiles.IMG_TO_WEBP, { base: `${SrcPath.IMG}` })
    .pipe(gulpIf(!isProductionMode, plumber()))
    .pipe(
      webp({
        quality: 90,
      }),
    )
    .pipe(dest(`${BuildPath.IMG}`));
};

const _buildWebp = series(buildWebp);
export { _buildWebp as buildWebp };

// SVG sprite

const buildSvgSprite = () => {
  return src(SrcFiles.SVG_TO_SPRITE)
    .pipe(
      imagemin([
        svgo({
          plugins: [
            {
              name: 'cleanupIDs',
              active: true,
            },
          ],
        }),
      ]),
    )
    .pipe(
      svgstore({
        inlineSvg: true,
      }),
    )
    .pipe(rename(SVG_SPRITE_FILENAME))
    .pipe(dest(`${BuildPath.IMG}`));
};

const _buildSvgSprite = series(buildSvgSprite);
export { _buildSvgSprite as buildSvgSprite };

// Fonts

const buildFonts = () => {
  return src(SrcFiles.FONTS).pipe(dest(`${BuildPath.FONTS}`));
};

const _buildFonts = series(buildFonts);
export { _buildFonts as buildFonts };

// Favicons

const buildFavicon = () => {
  return src(SrcFiles.FAVICON)
    .pipe(
      gulpIf(
        isProductionMode,
        imagemin([
          optipng({
            optimizationLevel: 3,
          }),
          svgo(),
        ]),
      ),
    )
    .pipe(dest(`${BuildPath.FAVICON}`));
};

const _buildFavicon = series(buildFavicon);
export { _buildFavicon as buildFavicon };

// ******************************* LOCAL SERVER ********************************

const startServer = () => {
  server.init({
    server: `${BUILD_PATH}`,
    cors: true,
    notify: false,
    injectChanges: false,
    ghostMode: {
      clicks: false,
      forms: false,
      scroll: false,
    },
  });

  // Watchers

  watch(
    [...SrcFiles.HTML, ...SrcFiles.SVG_TO_SPRITE],
    series(buildSvgSprite, buildHtml, reloadPage),
  );

  watch([...SrcFiles.SCSS, ...SrcFiles.SVG], series(buildCss, reloadPage));

  watch(SrcFiles.JS, series(buildJs, reloadPage));

  watch(SrcFiles.IMG, series(buildImg, reloadPage));

  watch(SrcFiles.IMG_TO_WEBP, series(buildWebp, reloadPage));

  watch(SrcFiles.FONTS, series(buildFonts, reloadPage));

  watch(SrcFiles.FAVICON, series(buildFavicon, reloadPage));
};

// *********************************** TASKS ***********************************

const builders = [
  series(buildSvgSprite, buildHtml),
  buildCss,
  buildJs,
  buildImg,
  buildWebp,
  buildFonts,
  buildFavicon,
];

const buildDev = series(clearBuildFolder, parallel(...builders));
const buildProd = series(
  enableProductionMode,
  clearBuildFolder,
  parallel(...builders),
  bustCache,
);
const startDev = series(buildDev, startServer);
const deployGhPages = series(buildProd, publishGhPages);

const _default = startDev;
export { _default as default };

const _buildProd = buildProd;
export { _buildProd as buildProd };

const _buildDev = buildDev;
export { _buildDev as buildDev };

const _deployGhPages = deployGhPages;
export { _deployGhPages as deployGhPages };
