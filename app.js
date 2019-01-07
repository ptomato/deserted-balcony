/* exported main */

const {Gdk, GObject, Gtk} = imports.gi;

const {DbModel} = imports.model;
const {DbWindow} = imports.win;

const App = GObject.registerClass(class App extends Gtk.Application {
    _init(props = {}) {
        props.applicationId = 'name.ptomato.DesertedBalcony';
        super._init(props);
    }

    static _loadCSSResource(resource) {
        const provider = new Gtk.CssProvider();
        provider.load_from_resource(resource);
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),
            provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    vfunc_startup() {
        super.vfunc_startup();

        App._loadCSSResource('/com/endlessm/HackToolbox/application.css');
        App._loadCSSResource('/name/ptomato/DesertedBalcony/application.css');

        const iconTheme = Gtk.IconTheme.get_default();
        iconTheme.add_resource_path('/com/endlessm/HackToolbox/icons');

        const settings = Gtk.Settings.get_default();
        settings.gtkApplicationPreferDarkTheme = true;
    }

    vfunc_activate() {
        super.vfunc_activate();

        const model = new DbModel();
        const win = new DbWindow(model, {application: this});
        win.show_all();
        win.present();
    }
});

function main(args) {
    const theApp = new App();
    theApp.run(args);
}
