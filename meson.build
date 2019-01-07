project('deserted-balcony', 'c', version: '0', license: ['proprietary'],
    meson_version: '>= 0.40.0')

gnome = import('gnome')

pkgdatadir = join_paths(get_option('datadir'), meson.project_name())
gjs = find_program('gjs', 'gjs-console')

subst = configuration_data()
subst.set('GJS', gjs.path())
subst.set('PACKAGE_VERSION', meson.project_version())
subst.set('prefix', get_option('prefix'))
subst.set('libdir', get_option('libdir'))
subst.set('datadir', get_option('datadir'))
configure_file(input: 'name.ptomato.DesertedBalcony.in',
    output: 'name.ptomato.DesertedBalcony',
    configuration: subst, install_dir: get_option('bindir'))

gnome.compile_resources('name.ptomato.DesertedBalcony.src',
    'name.ptomato.DesertedBalcony.src.gresource.xml',
    gresource_bundle: true, install: true, install_dir: pkgdatadir)

gnome.compile_resources('name.ptomato.DesertedBalcony.data',
    'name.ptomato.DesertedBalcony.data.gresource.xml',
    gresource_bundle: true, install: true, install_dir: pkgdatadir)
