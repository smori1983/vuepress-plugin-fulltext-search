const _ = require('lodash');
const Flexsearch = require('flexsearch');
const cjk = require('../misc/cjk');
const { highlightText } = require('vuepress-plugin-flexsearch/src/utils');

class SearchType1 {
  constructor(options) {
    const indexSettings = {
      encode: 'simple', //options.encode || 'simple',
      tokenize: 'forward', //options.tokenize || 'forward',
      split: /\W+/, // options.split || /\W+/,
      async: true,
      doc: {
        id: 'key',
        field: ['content'],
      },
    };

    /**
     * @private
     */
    this._indexDefault = new Flexsearch(indexSettings);

    /**
     * @private
     */
    this._indexCjk = new Flexsearch({
      ...indexSettings,
      encode: false,
      tokenize: cjk.tokenizer,
    });
  }

  buildIndex(allPages, options) {
    const pages = allPages.filter((p) => {
      return !p.frontmatter || p.frontmatter.search !== false;
    });

    this._indexDefault.add(pages);

    const pagesCjk = pages.filter((p) => {
      return p.charSets.cjk === true;
    })

    this._indexCjk.add(pagesCjk);
  }

  async match(query, limit = 7) {
    const searchParams = [
      {
        field: 'content',
        query: query,
        limit,
      },
    ];

    const resultDefault = await this._indexDefault.search(searchParams);
    const resultCjk = await this._indexCjk.search(searchParams);

    return _.uniqBy([...resultDefault, ...resultCjk], 'path')
      .map((page) => {
        return {
          ...page,
          title: this._getSuggestionTitle(page, query),
          text: this._getSuggestionText(page, query),
        };
      });
  }

  _getSuggestionTitle(page, query) {
    const title = page.title || page.regularPath;

    return highlightText(title, query);
  }

  _getSuggestionText(page, query) {
    const content = page.content;
    const queryIndex = content
      .toLowerCase()
      .indexOf(query.toLowerCase());
    const queryFirstWord = query.split(' ')[0];
    let startIndex =
      queryIndex === -1
        ? content.toLowerCase().indexOf(queryFirstWord.toLowerCase())
        : queryIndex;
    let prefix = '';
    if (startIndex > 15) {
      startIndex -= 15;
      prefix = '.. ';
    }
    const text = page.content.substr(startIndex, 60);

    return prefix + highlightText(text, query);
  }
}

module.exports = SearchType1;
