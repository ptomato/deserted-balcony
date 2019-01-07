/* exported DbWindow */

const {Gdk, GLib, GObject, Gtk, GtkSource} = imports.gi;

const {Codeview} = imports.codeview;
const {randomColor, validateRgbaString} = imports.colorUtils;
const {rgbaToString} = imports.framework.utils;
const SoundServer = imports.soundServer;

var DbWindow = GObject.registerClass(class DbWindow extends Gtk.ApplicationWindow {
    _init(model, props = {}) {
        this._keyUsed = false;
        // Before any code is entered, we have a blank onclick function
        // eslint-disable-next-line no-empty-function
        this._clickFuncFactory = () => function () {};

        this._model = model;
        this._notifyHandler = model.connect('notify', this._update.bind(this));

        Object.assign(props, {
            defaultWidth: 1200,
            defaultHeight: 600,
        });
        super._init(props);

        const grid = new Gtk.Grid({
            columnSpacing: 24,
            columnHomogeneous: true,
        });

        this._canvas = new Gtk.Frame({
            widthRequest: 100,
            heightRequest: 100,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });
        this._canvas.get_style_context().add_class('canvas');
        grid.add(this._canvas);

        this._clickTarget = new Gtk.EventBox({expand: true});
        this._clickTarget.connect('button-release-event', this._onCanvasClick.bind(this));
        this._canvas.add(this._clickTarget);

        this._notebook = new Gtk.Notebook();
        grid.add(this._notebook);

        const mainIcon = new Gtk.Image({iconName: 'emblem-system-symbolic'});
        this._mainCodeview = new Codeview();
        this._mainCodeview.connect('should-compile', this._mainCompile.bind(this));
        this._notebook.append_page(this._mainCodeview, mainIcon);

        this._addButton = Gtk.Button.new_from_icon_name('list-add-symbolic',
            Gtk.IconSize.BUTTON);
        this._addButton.valign = Gtk.Align.CENTER;
        const addButtonStyle = this._addButton.get_style_context();
        addButtonStyle.add_class('function-add-button');
        addButtonStyle.add_class('hint');
        this._addButton.connect('clicked', this._onAddClicked.bind(this));
        this._addButton.show_all();
        this._notebook.set_action_widget(this._addButton, Gtk.PackType.END);

        this.add(grid);

        this._canvasProvider = new Gtk.CssProvider();
        this._canvas.get_style_context().add_provider(this._canvasProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        this._update();
    }

    _update() {
        this._mainCodeview.text = this._model.generateCode();
        this._canvasProvider.load_from_data(this._model.generateCSS());
    }

    _errorRecordAtAssignmentLocation(variable, message) {
        const {start, end} = this._mainCodeview.findAssignmentLocation(variable);
        return {start, end, message, fixme: '"red"'};
    }

    _searchMainCodeForErrors(scope) {
        const errors = [];

        ['color', 'pulse_color'].forEach(prop => {
            if (scope[prop] !== null) {
                if (!validateRgbaString(scope[prop])) {
                    errors.push(this._errorRecordAtAssignmentLocation(prop,
                        `Unknown value "${scope[prop]}": value must be a ` +
                        'color, like "red" or "#729fcf"'));
                }
            }
        });

        return errors;
    }

    _mainCompile() {
        const code = this._mainCodeview.text;

        if (code === '')
            return;

        const scope = {
            color: null,
            pulse_color: null,
        };
        try {
            // eslint-disable-next-line no-new-func
            const func = new Function('scope', `with(scope){\n${code}\n;}`);
            func(scope);
        } catch (e) {
            if (!(e instanceof SyntaxError || e instanceof ReferenceError))
                throw e;
            this._mainCodeview.setCompileResults([{
                start: {
                    line: e.lineNumber - 1,  // remove the "with(scope)" line
                    column: e.columnNumber - 1,  // seems to be 1-based
                },
                message: e.message,
            }]);
            return;
        }

        if (Object.getOwnPropertyNames(scope).every(prop => prop === null))
            return;

        const errors = this._searchMainCodeForErrors(scope);
        if (errors.length > 0) {
            this._mainCodeview.setCompileResults(errors);
            return;
        }

        this._mainCodeview.setCompileResults([]);

        // Block the normal notify handler that updates the code view, since we
        // are propagating updates from the codeview to the GUI. Instead,
        // connect a temporary handler that lets us know if anything actually
        // did change.
        GObject.signal_handler_block(this._model, this._notifyHandler);

        let guiUpdated = false;
        const tempHandler = this._model.connect('notify', () => {
            guiUpdated = true;
        });

        try {
            ['color', 'pulse_color'].forEach(prop => {
                if (scope[prop] !== null) {
                    const rgba = new Gdk.RGBA();
                    rgba.parse(scope[prop]);
                    this._model[prop] = rgba;
                }
            });
        } finally {
            this._model.disconnect(tempHandler);
            GObject.signal_handler_unblock(this._model, this._notifyHandler);
        }

        if (guiUpdated) {
            this._update();
            SoundServer.getDefault().play('hack-toolbox/update-gui');
        }
    }

    _onAddClicked(button) {
        const popover = new Gtk.Popover({
            modal: true,
            relativeTo: button,
            borderWidth: 12,
        });
        if (this._keyUsed) {
            const label = new Gtk.Label({
                label: "You don't have any more items that fit here.",
                visible: true,
            });
            popover.add(label);
        } else {
            const grid = new Gtk.Grid({
                rowSpacing: 6,
                orientation: Gtk.Orientation.VERTICAL,
            });
            popover.add(grid);
            const label = new Gtk.Label({
                label: 'You have an item that fits here!',
            });
            const itemButton = Gtk.Button.new_from_icon_name('insert-object-symbolic',
                Gtk.IconSize.BUTTON);
            Object.assign(itemButton, {
                label: 'Click Function',
                alwaysShowImage: true,
            });
            itemButton.get_style_context().add_class('item-button');
            grid.add(label);
            grid.add(itemButton);
            grid.show_all();
            itemButton.connect('clicked', this._onAddClickFunction.bind(this, popover));
        }
        popover.connect('closed', () => popover.destroy());
        popover.popup();
    }

    _getFrozenTextExtents(view, iter) {
        const tagStartIter = iter.copy();
        if (!tagStartIter.starts_tag(this._frozenTag))
            tagStartIter.backward_to_tag_toggle(this._frozenTag);
        const startRect = view.get_iter_location(tagStartIter);

        const tagEndIter = iter.copy();
        if (!tagEndIter.ends_tag(this._frozenTag))
            tagEndIter.forward_to_tag_toggle(this._frozenTag);
        const endRect = view.get_iter_location(tagEndIter);

        return startRect.union(endRect);
    }

    _onFrozenTagEvent(tag, view, event, iter) {
        if (event.get_event_type() !== Gdk.EventType.BUTTON_RELEASE)
            return Gdk.EVENT_PROPAGATE;

        const frozenArea = this._getFrozenTextExtents(view, iter);
        const {x: xBuf, y: yBuf} = frozenArea;
        const [xWin, yWin] = view.buffer_to_window_coords(Gtk.TextWindowType.WIDGET,
            xBuf, yBuf);
        frozenArea.x = xWin;
        frozenArea.y = yWin;
        const popover = new Gtk.Popover({
            modal: true,
            relativeTo: view,
            pointingTo: frozenArea,
            borderWidth: 12,
        });
        popover.add(new Gtk.Label({
            label: 'This text is frozen, in order to\n' +
                'keep the name and parameters of the\n' +
                'function always the same.\n\n' +
                'We could also leave them editable\n' +
                'but treat that as an error.',
            visible: true,
        }));
        popover.connect('closed', () => popover.destroy());
        popover.popup();

        return Gdk.EVENT_PROPAGATE;
    }

    _onAddClickFunction(popover) {
        popover.popdown();
        this._keyUsed = true;
        this._addButton.get_style_context().remove_class('hint');

        const clickIcon = new Gtk.Image({iconName: 'insert-object-symbolic'});
        this._clickCodeview = new Codeview();
        this._clickCodeview.text = this._model.generateUserFunction('click');

        const frozenBackground = new Gdk.RGBA({
            red: 0.9,
            green: 0.9,
            blue: 1.0,
            alpha: 0.2,
        });
        this._frozenTag = new GtkSource.Tag({
            name: 'frozen',
            editable: false,
            editableSet: true,
            paragraphBackgroundRgba: frozenBackground,
            paragraphBackgroundSet: true,
            pixelsAboveLines: 6,
            pixelsAboveLinesSet: true,
            pixelsBelowLines: 6,
            pixelsBelowLinesSet: true,
        });
        this._frozenTag.connect('event', this._onFrozenTagEvent.bind(this));

        // Apply "frozen" tag to "function foo() {" and "}", and pop up an
        // explanation for the frozen text when hovered
        // FIXME, reaching into codeview internals here
        const buffer = this._clickCodeview._buffer;
        buffer.tagTable.add(this._frozenTag);
        let start = buffer.get_start_iter();
        let end = start.copy();
        end.forward_to_line_end();
        buffer.apply_tag(this._frozenTag, start, end);
        end = buffer.get_end_iter();
        start = end.copy();
        start.backward_line();
        buffer.apply_tag(this._frozenTag, start, end);

        this._clickCodeview.connect('should-compile', this._clickCompile.bind(this));

        this._clickInfoBar = new Gtk.InfoBar({
            messageType: Gtk.MessageType.ERROR,
            showCloseButton: true,
            noShowAll: true,
        });
        this._clickRuntimeErrorMessage = new Gtk.Label({
            useMarkup: true,
            visible: true,
        });
        this._clickInfoBar.get_content_area().add(this._clickRuntimeErrorMessage);
        this._clickInfoBar.connect('response', widget => widget.hide());

        const grid = new Gtk.Grid({orientation: Gtk.Orientation.VERTICAL});
        grid.add(this._clickInfoBar);
        grid.add(this._clickCodeview);
        grid.show_all();

        this._clickNotebookIndex = this._notebook.append_page(grid, clickIcon);
        this._notebook.page = this._clickNotebookIndex;
    }

    _clickCompile() {
        const code = this._clickCodeview.text;

        if (code === '')
            return;

        // This scope object is just for validating the code, so its methods
        // don't do anything. It only needs to contain all the global names
        // that should be available to the function.
        const testScope = {
            color: rgbaToString(this._model.color),
            pulse_color: rgbaToString(this._model.pulse_color),
            randomColor() {},  // eslint-disable-line no-empty-function
        };
        try {
            // eslint-disable-next-line no-new-func
            this._clickFuncFactory = new Function('scope',
                `with(scope){\n${code}\n;return click;}`);
            const clickFunc = this._clickFuncFactory(testScope);
            // Similar to the scope object, this object is just for validating
            // the code. It needs to contain all the properties on the 'circle'
            // object that will be passed in to the real function.
            const testCircle = {
                inflate() {},  // eslint-disable-line no-empty-function
            };
            clickFunc(testCircle);
        } catch (e) {
            // We don't want to limit ourselves to catching ReferenceError and
            // SyntaxError here, as we are actually executing the code with
            // dummy scope and circle objects, so for example 'circle.foo()'
            // would throw 'TypeError: circle.foo is not a function'.
            //
            // This is both good and bad. Good because we can catch more errors
            // in the validation stage, before they become runtime errors. Bad
            // because we are executing the function with slightly different
            // behaviour than it will actually display at runtime, and also bad
            // because we can validate some but not all errors this way, yet
            // raise the expectation that the validation can do everything.
            //
            // In the case of a "toy app" in browser-JS, this part is executed
            // on the toolbox side.
            this._clickCodeview.setCompileResults([{
                start: {
                    // remove the "with(scope)" line, and it's not clear where
                    // the other offset of 2 is coming from.
                    line: e.lineNumber - 3,
                    column: e.columnNumber - 1,  // seems to be 1-based
                },
                message: e.message,
            }]);
            return;
        }

        this._clickCodeview.setCompileResults([]);

        // Block the normal notify handler that updates the code view, since we
        // are propagating updates from the codeview to the GUI.
        GObject.signal_handler_block(this._model, this._notifyHandler);

        let guiUpdated = false;
        const tempHandler = this._model.connect('notify', () => {
            guiUpdated = true;
        });

        try {
            this._model.clickFunction = code;
        } finally {
            this._model.disconnect(tempHandler);
            GObject.signal_handler_unblock(this._model, this._notifyHandler);
        }

        if (guiUpdated) {
            this._update();
            SoundServer.getDefault().play('hack-toolbox/update-gui');
        }
    }

    _inflateCircle() {
        this._canvas.get_style_context().add_class('inflate');
        GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 2, () => {
            this._canvas.get_style_context().remove_class('inflate');
            return GLib.SOURCE_REMOVE;
        });
    }

    _onCanvasClick() {
        // Now we create the click function with a real scope object
        const scope = {
            _color: rgbaToString(this._model.color),
            _colorWasSet: false,
            get color() {
                return this._color;
            },
            set color(value) {
                if (!validateRgbaString(value))
                    throw new RangeError(`invalid color "${value}"`);
                this._color = value;
                this._colorWasSet = true;
            },

            _pulseColor: rgbaToString(this._model.pulse_color),
            _pulseColorWasSet: false,
            get pulse_color() {
                return this._pulseColor;
            },
            set pulse_color(value) {
                if (!validateRgbaString(value))
                    throw new RangeError(`invalid color "${value}"`);
                this._pulseColor = value;
                this._pulseColorWasSet = true;
            },

            randomColor,
        };
        try {
            const clickFunc = this._clickFuncFactory(scope);
            // Here we invoke the click function with the real circle object
            // that we want to pass in, with any properties and methods that we
            // want to be available to the user function.
            // In the case of a "toy app" in browser-JS, this part is actually
            // executed on the browser side.
            const circle = {
                inflate: this._inflateCircle.bind(this),
            };
            clickFunc(circle);
        } catch (e) {
            this._displayRuntimeError(e);
            return Gdk.EVENT_STOP;
        }

        if (scope._colorWasSet) {
            const rgba = validateRgbaString(scope._color);
            if (rgba)
                this._model.color = rgba;
        }
        if (scope._pulseColorWasSet) {
            const rgba = validateRgbaString(scope._pulseColor);
            if (rgba)
                this._model.pulse_color = rgba;
        }
        return Gdk.EVENT_PROPAGATE;
    }

    // We need to have some way for the hackable app to communicate runtime
    // errors back to the toolbox, and possibly even flip over the app if the
    // error occurs while it's on the front side.
    _displayRuntimeError(err) {
        logError(err, 'Displaying runtime error');

        const stackLines = err.stack.split('\n');
        let message = `An error happened in the <b>click</b> function.
Error message: ${err.message}`;

        const line = stackLines.find(msg => msg.includes('> Function'));
        if (typeof line !== 'undefined') {
            const match = (/> Function:(\d+):(\d+)/).exec(line);
            if (match !== null) {
                const [, lineNo] = match;
                // subtract 1 due to "with(scope){" line, and it's not clear
                // where the other offset of 2 is coming from.
                message += `\nThe error happened at <b>line ${lineNo - 3}</b>.
Check there and see what might be happening!`;
            }
        }

        this._clickRuntimeErrorMessage.label = message;
        this._clickInfoBar.show();
        this._notebook.page = this._clickNotebookIndex;
    }
});
