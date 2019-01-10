/* exported randomColor, rgbaToCss, validateRgbaString */

const {Gdk} = imports.gi;

const {rgbaToString} = imports.framework.utils;

const X11_COLORS = ['alice blue', 'antique white', 'aquamarine', 'azure',
    'beige', 'bisque', 'black', 'blanched almond', 'blue', 'blue violet',
    'brown', 'burlywood', 'cadet blue', 'chartreuse', 'chocolate', 'coral',
    'cornflower blue', 'cornsilk', 'crimson', 'cyan', 'dark blue', 'dark cyan',
    'dark goldenrod', 'dark gray', 'dark green', 'dark khaki', 'dark magenta',
    'dark olive green', 'dark orange', 'dark orchid', 'dark red', 'dark salmon',
    'dark sea green', 'dark slate blue', 'dark slate gray', 'dark turquoise',
    'dark violet', 'deep pink', 'deep sky blue', 'dim gray', 'dodger blue',
    'firebrick', 'floral white', 'forest green', 'gainsboro', 'ghost white',
    'gold', 'goldenrod', 'gray', 'green', 'green yellow', 'honeydew',
    'hot pink', 'indian red', 'indigo', 'ivory', 'khaki', 'lavender',
    'lavender blush', 'lawn green', 'lemon chiffon', 'light blue',
    'light coral', 'light cyan', 'light goldenrod', 'light gray', 'light green',
    'light pink', 'light salmon', 'light sea green', 'light sky blue',
    'light slate gray', 'light steel blue', 'light yellow', 'lime green',
    'linen', 'magenta', 'maroon', 'medium aquamarine', 'medium blue',
    'medium orchid', 'medium purple', 'medium sea green', 'medium slate blue',
    'medium spring green', 'medium turquoise', 'medium violet red',
    'midnight blue', 'mint cream', 'misty rose', 'moccasin', 'navajo white',
    'navy blue', 'old lace', 'olive', 'olive drab', 'orange', 'orange red',
    'orchid', 'pale goldenrod', 'pale green', 'pale turquoise',
    'pale violet red', 'papaya whip', 'peach puff', 'peru', 'pink', 'plum',
    'powder blue', 'purple', 'rebecca purple', 'red', 'rosy brown',
    'royal blue', 'saddle brown', 'salmon', 'sandy brown', 'sea green',
    'seashell', 'sienna', 'silver', 'sky blue', 'slate blue', 'slate gray',
    'snow', 'spring green', 'steel blue', 'tan', 'teal', 'thistle', 'tomato',
    'turquoise', 'violet', 'wheat', 'white', 'white smoke', 'yellow',
    'yellow green'];

function randomColor() {
    const index = Math.floor(Math.random() * X11_COLORS.length);
    return X11_COLORS[index];
}

// CSS color names don't have spaces. Some of the ones understood by
// Gdk.RGBA.parse() do.
function rgbaToCss(rgba) {
    const color = rgbaToString(rgba);
    return color.replace(/ /g, '');
}

function validateRgbaString(str) {
    const rgba = new Gdk.RGBA();
    try {
        if (!rgba.parse(str))
            return null;
    } catch (e) {
        return null;
    }
    return rgba;
}
