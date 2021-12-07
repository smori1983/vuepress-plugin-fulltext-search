<template>
  <div class="search-box">
    <form @submit.prevent="go(focusIndex)">
      <input
        ref="input"
        aria-label="Search"
        :value="query"
        :class="{ 'focused': focused }"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
        @input="query = $event.target.value"
        @focus="focused = true"
        @blur="focused = false"
        @keyup.up="onUp"
        @keyup.down="onDown"
      >
    </form>
    <ul
      v-if="showSuggestions"
      class="suggestions"
      :class="{ 'align-right': alignRight }"
      @mouseleave="unfocus"
    >
      <li
        v-for="(s, i) in suggestions"
        :key="i"
        class="suggestion"
        :class="{ focused: i === focusIndex }"
        @mousedown="go(i)"
        @mouseenter="focus(i)"
      >
        <a
          :href="s.path"
          @click.prevent
        >
          <span
            v-html="s.title || s.regularPath"
            class="suggestion__title"
          ></span>
          <span v-html="s.text" class="suggestion__result"></span>
          <!--
          <span class="page-title">{{ s.title || s.path }}</span>
          <span
            v-if="s.header"
            class="header"
          >&gt; {{ s.header.title }}</span>
          -->
        </a>
      </li>
    </ul>
  </div>
</template>

<script>
import VueRouter from 'vue-router';
const { isNavigationFailure, NavigationFailureType } = VueRouter;
import SearchType1 from '../services/search-type1';

/**
 * @type {SearchType1}
 */
let search;

/* global SEARCH_MAX_SUGGESTIONS, SEARCH_PATHS, SEARCH_HOTKEYS */
export default {
  name: 'SearchBox',

  data () {
    return {
      query: '',
      focused: false,
      focusIndex: 0,
      placeholder: undefined,
      suggestions: null,
    };
  },

  computed: {
    showSuggestions () {
      console.log('[showSuggestions]');
      console.log(this.focused);
      console.log(this.suggestions);
      return (
        this.focused
        && this.suggestions
        && this.suggestions.length
      )
    },

    // make suggestions align right when there are not enough items
    alignRight () {
      const navCount = (this.$site.themeConfig.nav || []).length
      const repo = this.$site.repo ? 1 : 0
      return navCount + repo <= 2
    }
  },

  watch: {
    query() {
      this.getSuggestions();
    }
  },

  mounted () {
    this.placeholder = this.$site.themeConfig.searchPlaceholder || '';
    document.addEventListener('keydown', this.onHotkey);

    search = new SearchType1();
    search.buildIndex(this.$site.pages);
  },

  beforeDestroy () {
    document.removeEventListener('keydown', this.onHotkey);
  },

  methods: {
    async getSuggestions () {
      const query = this.query.trim().toLowerCase();
      if (!query) {
          return;
      }

      this.suggestions = await search.match(query);
    },

    getPageLocalePath (page) {
      for (const localePath in this.$site.locales || {}) {
        if (localePath !== '/' && page.path.indexOf(localePath) === 0) {
          return localePath
        }
      }
      return '/'
    },

    onHotkey (event) {
      if (event.srcElement === document.body && SEARCH_HOTKEYS.includes(event.key)) {
        this.$refs.input.focus()
        event.preventDefault()
      }
    },

    onUp () {
      if (this.showSuggestions) {
        if (this.focusIndex > 0) {
          this.focusIndex--
        } else {
          this.focusIndex = this.suggestions.length - 1
        }
      }
    },

    onDown () {
      if (this.showSuggestions) {
        if (this.focusIndex < this.suggestions.length - 1) {
          this.focusIndex++
        } else {
          this.focusIndex = 0
        }
      }
    },

    go (i) {
      if (!this.showSuggestions) {
        return;
      }

      this.$router.push(this.suggestions[i].path).catch((failure) => {
        if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
          console.log('[duplicated]');
        }
      });
      this.query = '';
      this.focusIndex = 0;
    },

    focus (i) {
      this.focusIndex = i
    },

    unfocus () {
      this.focusIndex = -1
    }
  }
}
</script>

<style lang="stylus">
.search-box
  display inline-block
  position relative
  margin-right 1rem
  input
    cursor text
    width 10rem
    height: 2rem
    color lighten($textColor, 25%)
    display inline-block
    border 1px solid darken($borderColor, 10%)
    border-radius 2rem
    font-size 0.9rem
    line-height 2rem
    padding 0 0.5rem 0 2rem
    outline none
    transition all .2s ease
    background #fff url(../assets/search.svg) 0.6rem 0.5rem no-repeat
    background-size 1rem
    &:focus
      cursor auto
      width: 15rem;
      border-color $accentColor
  .suggestions
    background #fff
    width 20rem
    position absolute
    top 2 rem
    border 1px solid darken($borderColor, 10%)
    border-radius 6px
    padding 0.4rem
    list-style-type none
    &.align-right
      right 0
  .suggestion
    line-height 1.4
    padding 0.4rem 0.6rem
    border-radius 4px
    cursor pointer
    a
      white-space normal
      color lighten($textColor, 35%)
      em
        color $accentColor
        font-weight bold
        font-style normal
      .suggestion__title
        font-weight 600
        color $textColor
        display block
        padding-bottom .4rem
      .suggestion__text
        font-size 0.9em
    &.focused
      background-color #f3f4f5
      a
        color $accentColor

@media (max-width: $MQNarrow)
  .search-box
    input
      cursor pointer
      width 0
      border-color transparent
      position relative
      &:focus
        cursor text
        left 0
        width 10rem

// Match IE11
@media all and (-ms-high-contrast: none)
  .search-box input
    height 2rem

@media (max-width: $MQNarrow) and (min-width: $MQMobile)
  .search-box
    .suggestions
      left 0

@media (max-width: $MQMobile)
  .search-box
    margin-right 0
    input
      left 1rem
    .suggestions
      right 0

@media (max-width: $MQMobileNarrow)
  .search-box
    .suggestions
      width calc(100vw - 4rem)
    input:focus
      width 8rem
</style>
