/* exported DbModel */

const {Gdk, GLib, GObject} = imports.gi;

const {rgbaToCss} = imports.colorUtils;
const {rgbaToString} = imports.framework.utils;

const _PROP_FLAGS = GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT;

const _DEFAULT_CLICK_FUNCTION = `function click(circle) {
    // Here are some examples of what you can do
    // with the click function.
    // Uncomment each block to try it out.

    // Inflate the circle briefly when clicked. This
    // demonstrates how the game can expose APIs to
    // the code view.

    // circle.inflate();

    // Toggle between red and green on click. This
    // demonstrates how the game can allow variables
    // to be set dynamically, not just once in the
    // main code panel:

    // if (color === 'tomato')
    //      color = 'sea green';
    // else
    //      color = 'tomato';

    // Pick a random color for the halo on click:

    // pulse_color = randomColor();

    // Here's an example of a runtime error that
    // can't be detected beforehand. The toolbox
    // user interface, as well as the game, will
    // need to know how to deal with this.

    // if (randomColor() !== '#invalidcolor321')
    //     color = '#invalidcolor123';
}
`;

var DbModel = GObject.registerClass({
    Properties: {
        color: GObject.ParamSpec.boxed('color', 'Color', '', _PROP_FLAGS, Gdk.RGBA),
        'pulse-color': GObject.ParamSpec.boxed('pulse-color', 'Pulse Color', '',
            _PROP_FLAGS, Gdk.RGBA),
        'click-function': GObject.ParamSpec.string('click-function', 'Click Function', '',
            _PROP_FLAGS, _DEFAULT_CLICK_FUNCTION),
    },
}, class DbModel extends GObject.Object {
    _init(props = {}) {
        super._init(props);

        // boxed properties are set to null during construct
        if (!this._color) {
            this._color = new Gdk.RGBA();
            if (!this._color.parse('#daa520'))
                throw new Error('bad color default');
        }
        if (!this._pulseColor)
            this._pulseColor = new Gdk.RGBA(this._color);
    }

    get color() {
        return this._color;
    }

    set color(value) {
        if ('_color' in this &&
            this._color !== null && value !== null &&
            this._color.equal(value))
            return;
        this._color = value;
        this.notify('color');
    }

    get pulse_color() {
        return this._pulseColor;
    }

    set pulse_color(value) {
        if ('_pulseColor' in this &&
            this._pulseColor !== null && value !== null &&
            this._pulseColor.equal(value))
            return;
        this._pulseColor = value;
        this.notify('pulse-color');
    }

    get click_function() {
        return this._clickFunction;
    }

    set click_function(value) {
        if ('_clickFunction' in this && this._clickFunction === value)
            return;
        this._clickFunction = value;
        this.notify('click-function');
    }

    generateCSS() {
        const partialTransparent = new Gdk.RGBA(this._pulseColor);
        partialTransparent.alpha *= 0.6;
        const fullTransparent = new Gdk.RGBA(this._pulseColor);
        fullTransparent.alpha = 0;
        const cachebuster = GLib.get_monotonic_time();
        return `
            .canvas {
                background: ${rgbaToCss(this._color)};
                box-shadow: 0 0 0 ${rgbaToCss(partialTransparent)};
                animation: pulse${cachebuster} 2s infinite;
            }
            @keyframes pulse${cachebuster} {
                0% {   box-shadow: 0 0 0 0    ${rgbaToCss(partialTransparent)}; }
                70% {  box-shadow: 0 0 0 20px ${rgbaToCss(fullTransparent)}; }
                100% { box-shadow: 0 0 0 0    ${rgbaToCss(fullTransparent)}; }
            }
        `;
    }

    generateCode() {
        return `
// Colors

color = '${rgbaToString(this._color)}';
pulse_color = '${rgbaToString(this._pulseColor)}';
`;
    }

    generateUserFunction(key) {
        if (key === 'click')
            return this._clickFunction;

        throw new Error(`oops, unknown user function key ${key}`);
    }
});
