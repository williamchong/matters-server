import xss from 'xss'

const CUSTOM_WHITE_LISTS = {
  a: [...(xss.whiteList.a || []), 'class'],
  figure: [],
  figcaption: [],
  iframe: ['src', 'class']
}

export const sanitize = (string: string) =>
  xss(string, {
    whiteList: { ...xss.whiteList, ...CUSTOM_WHITE_LISTS },
    onIgnoreTagAttr: function(tag, name, value, isWhiteAttr) {
      /**
       * Allow attributes of whitelist tags start with "data-"
       *
       * @see https://github.com/leizongmin/js-xss#allow-attributes-of-whitelist-tags-start-with-data-
       */
      if (name.substr(0, 5) === 'data-') {
        // escape its value using built-in escapeAttrValue function
        return name + '="' + xss.escapeAttrValue(value) + '"'
      }
    }
  })
