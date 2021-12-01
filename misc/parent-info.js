import _ from 'lodash'

export default class ParentInfo {
  constructor(pages) {
    /**
     * @private
     */
    this._pagesByPath = _.keyBy(pages, 'path')
  }

  /**
   * @param page
   * @returns {string}
   */
  getParentPageTitle(page) {
    const parentPath = this._getParentPath(page)
    const parentPage = this._pagesByPath[parentPath] || page

    return parentPage.title
  }

  /**
   * Possible patterns:
   * - '/' (= '/README.md')
   * - '/page.html'
   * - '/path1/' (= '/path1/README.md')
   * - '/path1/page.html'
   * - '/path1/path2/' (= '/path1/path2/README.md')
   * - '/path1/path2/page.html'
   *
   * @param page
   * @returns {string}
   * @private
   */
  _getParentPath(page) {
    if (page.path === '/') {
      return '/'
    }

    /** @type {string[]} */
    const pathParts = page.path.split('/')

    if (pathParts.slice(-1).join() === '') {
      return pathParts.slice(0, -2).concat(['']).join('/')
    } else {
      return pathParts.slice(0, -1).concat(['']).join('/')
    }
  }
}
