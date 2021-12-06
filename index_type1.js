const { path } = require('@vuepress/shared-utils');
const { htmlToText } = require('html-to-text');
const cjk = require('./misc/cjk');

module.exports = (options, ctx, globalCtx) => ({
  extendPageData($page) {
    const { html } = $page._context.markdown.render($page._strippedContent || '');

    const plainText = htmlToText(html, {
      wordwrap: null,
      hideLinkHrefIfSameAsText: true,
      ignoreImage: true,
      ignoreHref: true,
      uppercaseHeadings: false,
      tables: true,
    });

    $page.content = plainText;
    $page.charSets = cjk.getCharsets(plainText);
  },
  alias: {
    '@SearchBox': path.resolve(__dirname, 'components', 'SearchBoxType1.vue'),
  },
  define: {
  },
});
