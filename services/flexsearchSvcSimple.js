import Flexsearch from 'flexsearch'
// Use when flexSearch v0.7.0 will be available
// import cjkCharset from 'flexsearch/dist/lang/cjk/default.min.js'
import _ from 'lodash'

import cjkTokenizer from '../misc/cjk-tokenizer'

let index = null
let cjkIndex = null
let pagesByPath = null

export default {
  buildIndex(allPages, options) {
    const pages = allPages.filter(p => !p.frontmatter || p.frontmatter.search !== false)
    const indexSettings = {
      encode: options.encode || 'simple',
      tokenize: options.tokenize || 'forward',
      split: options.split || /\W+/,
      async: true,
      doc: {
        id: 'key',
        // here you choose the fields you want to index.
        // for me I will search in the title and the content of each page.
        // of course I stripped the content before so I use the plain text content not the markdown text
        field: ['title', 'headersStr', 'content'],
      },
    }
    index = new Flexsearch(indexSettings)
    index.add(pages)

    const cjkPages = pages.filter(p => p.charsets.cjk)

    if (cjkPages.length) {
      cjkIndex = new Flexsearch({
        ...indexSettings,
        encode: false,
        tokenize: cjkTokenizer,
      })
      cjkIndex.add(cjkPages)
    }
    pagesByPath = _.keyBy(pages, 'path')
  },
  /**
   * @param {string} queryString
   * @param {string[]} queryTerms
   * @param {number} [limit]
   * @returns {Promise<MatchResult[]>}
   */
  async match(queryString, queryTerms, limit = 7) {
    const searchParams = [
      {
        field: 'title',
        query: queryString,
        limit,
        boost: 10,
      },
      {
        field: 'headersStr',
        query: queryString,
        limit,
        boost: 7,
      },
      {
        field: 'content',
        query: queryString,
        limit,
      },
    ]
    const searchResult1 = await index.search(searchParams)
    const searchResult3 = cjkIndex ? await cjkIndex.search(searchParams) : []
    const searchResult = _.uniqBy([...searchResult1, ...searchResult3], 'path')
    const result = searchResult.map(page => ({
      ...page,
      parentPageTitle: getParentPageTitle(page),
      ...getAdditionalInfo(page, normalizeString(queryString), queryTerms),
    }))

    const resultByParent = _.groupBy(result, 'parentPageTitle')
    return _.values(resultByParent)
      .map(arr =>
        arr.map((x, i) => {
          if (i === 0) return x
          return { ...x, parentPageTitle: null }
        }),
      )
      .flat()
  },
  normalizeString,
}

/**
 * @typedef {Object} MatchResult
 * @property {string} key
 * @property {string} title
 * @property {Object} frontmatter
 * @property {Object[]} headers
 * @property {string} path
 * @property {string} regularPath
 * @property {string} relativePath
 *
 * @property {Object} charsets
 * @property {(string|null)} headersStr
 * @property {string} content
 * @property {string} normalizedContent
 *
 * @property {(string|null)} parentPageTitle
 *
 * @property {string} headingStr
 * @property {(number[]|false)} [headingHighlight]
 * @property {string} slug
 * @property {(string|null)} contentStr
 * @property {number[]} [contentHighlight]
 */

/**
 * @param page
 * @returns {string}
 */
function getParentPageTitle(page) {
  const pathParts = page.path.split('/')
  let parentPagePath = '/'

  if (pathParts[1]) {
    parentPagePath = `/${pathParts[1]}/`
  }

  const parentPage = pagesByPath[parentPagePath] || page

  return parentPage.title
}

/**
 * @typedef {Object} AdditionalInfo
 * @property {string} headingStr
 * @property {(number[]|false)} [headingHighlight]
 * @property {string} slug
 * @property {(string|null)} contentStr
 * @property {number[]} [contentHighlight]
 */

/**
 * @param page
 * @param {string} queryString
 * @param {string[]} queryTerms
 * @returns {AdditionalInfo}
 */
function getAdditionalInfo(page, queryString, queryTerms) {
  const query = queryString.toLowerCase()
  const match = getMatch(page, query, queryTerms)

  if (!match) {
    return {
      ...getFullHeading(page),
      slug: '',
      contentStr: null,
    }
  }

  if (match.headerIndex != null) {
    // header match
    return {
      ...getFullHeading(page, match.headerIndex, match),
      slug: '#' + page.headers[match.headerIndex].slug,
      contentStr: null,
    }
  }

  // content match
  let headerIndex = _.findLastIndex(page.headers || [], h => h.charIndex != null && h.charIndex < match.charIndex)
  if (headerIndex === -1) headerIndex = null

  return {
    ...getFullHeading(page, headerIndex),
    slug: headerIndex == null ? '' : '#' + page.headers[headerIndex].slug,
    ...getContentStr(page, match),
  }
}

/**
 * @typedef {Object} MatchInformation
 * @property {(number|null)} headerIndex
 * @property {number} charIndex
 * @property {number} termLength
 */

/**
 * @param page
 * @param query
 * @param terms
 * @returns {MatchInformation|null}
 */
function getMatch(page, query, terms) {
  const matches = terms
    .map(t => {
      return getHeaderMatch(page, t) || getContentMatch(page, t)
    })
    .filter(m => m)

  if (matches.length === 0) {
    return null
  }

  if (matches.every(m => m.headerIndex != null)) {
    return getHeaderMatch(page, query) || matches[0]
  }

  return getContentMatch(page, query) || matches.find(m => m.headerIndex == null)
}

/**
 * @param page
 * @param term
 * @returns {MatchInformation|null}
 */
function getHeaderMatch(page, term) {
  if (!page.headers) {
    return null
  }

  for (let i = 0; i < page.headers.length; i++) {
    const h = page.headers[i]
    const charIndex = h.normalizedTitle.indexOf(term)

    if (charIndex === -1) {
      continue
    }

    return {
      headerIndex: i,
      charIndex,
      termLength: term.length,
    }
  }

  return null
}

/**
 * @param page
 * @param term
 * @returns {MatchInformation|null}
 */
function getContentMatch(page, term) {
  if (!page.normalizedContent) {
    return null
  }

  const charIndex = page.normalizedContent.indexOf(term)

  if (charIndex === -1) {
    return null
  }

  return {
    headerIndex: null,
    charIndex,
    termLength: term.length,
  }
}

/**
 * @typedef {Object} FullHeadingInfo
 * @property {string} headingStr
 * @property {number[]|false} [headingHighlight]
 */

/**
 *
 * @param page
 * @param {(number|null)} [headerIndex]
 * @param {MatchInformation} [match]
 * @returns {FullHeadingInfo}
 */
function getFullHeading(page, headerIndex, match) {
  if (headerIndex == null) {
    return {
      headingStr: page.title,
    }
  }

  const headersPath = []
  while (headerIndex != null) {
    const header = page.headers[headerIndex]
    headersPath.unshift(header)
    headerIndex = _.findLastIndex(page.headers, h => h.level === header.level - 1, headerIndex - 1)
    if (headerIndex === -1) {
      headerIndex = null
    }
  }

  const headingStr = headersPath.map(h => h.title).join(' > ')
  const prefixPath = headersPath.slice(0, -1)
  const prefixLength = _.sum(prefixPath.map(p => (p.title || '').length)) + prefixPath.length * 3
  const headingHighlight = match && match.headerIndex != null && [match.charIndex + prefixLength, match.termLength]

  return {
    headingStr,
    headingHighlight,
  }
}

/**
 * @typedef {Object} ContentStrInfo
 * @property {string} contentStr
 * @property {number[]} contentHighlight
 */

/**
 *
 * @param page
 * @param {MatchInformation} match
 * @returns {ContentStrInfo}
 */
function getContentStr(page, match) {
  const snippetLength = 120
  const { charIndex, termLength } = match

  let lineStartIndex = page.content.lastIndexOf('\n', charIndex)
  let lineEndIndex = page.content.indexOf('\n', charIndex)

  if (lineStartIndex === -1) {
    lineStartIndex = 0
  }
  if (lineEndIndex === -1) {
    lineEndIndex = page.content.length
  }

  const line = page.content.slice(lineStartIndex, lineEndIndex)
  const lineCharIndex = charIndex - lineStartIndex
  const contentHighlight = [lineCharIndex, termLength]

  if (snippetLength >= line.length) {
    return {
      contentStr: line,
      contentHighlight,
    }
  }

  const additionalCharactersFromStart = _.round((snippetLength - termLength) / 2)
  const snippetStart = Math.max(lineCharIndex - additionalCharactersFromStart, 0)
  const snippetEnd = Math.min(snippetStart + snippetLength, line.length)
  let contentStr = line.slice(snippetStart, snippetEnd)
  contentHighlight[0] = contentHighlight[0] - snippetStart

  if (snippetStart > 0) {
    contentStr = '...' + contentStr
    contentHighlight[0] = contentHighlight[0] + 3
  }

  if (snippetEnd < line.length) {
    contentStr = contentStr + '...'
  }

  return {
    contentStr,
    contentHighlight,
  }
}

function normalizeString(str) {
  if (!str) return str
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
