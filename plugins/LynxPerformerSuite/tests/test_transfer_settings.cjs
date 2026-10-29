/* Mocked React settings acceptance. No browser, server, or saved settings. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'settings-catalog.json')));
const code = fs.readFileSync(path.join(root, 'settings-ui.js'), 'utf8');

function render(saved = {}) {
  let callback, stateIndex = 0;
  const patches = [];
  const configuration = {LynxPerformerSuite: saved};
  const states = ['', configuration, catalog, '', false, ''];
  const React = {
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    isValidElement: el => !!el && typeof el === 'object' && 'type' in el,
    cloneElement: (el, props, children) => ({...el, props: {...el.props, ...props, children}}),
    Children: {map: (children, cb) => Array.isArray(children) ? children.flat(Infinity).map(cb) : children == null ? children : cb(children)},
    useState: () => [states[stateIndex++], () => {}],
    useEffect: () => {},
  };
  const window = {PluginApi: {React, patch: {after: (name, cb) => callback = cb}},
    LynxPerformerDefaults: {resolve: () => ({values: {}, sources: {}}), imageCategories: [],
      defaults: {}, configuration: async () => configuration,
      save: async patch => {patches.push(patch); return configuration;}}};
  vm.runInNewContext(code, {window, fetch: async () => ({ok: true, json: async () => catalog})});
  const controls = Object.keys(catalog).map(key => React.createElement('native', {pluginID: 'LynxPerformerSuite', setting: {name: key}}));
  const panel = callback({pluginID: 'LynxPerformerSuite'}, React.createElement('div', {}, controls));
  function flatten(node) {
    if (Array.isArray(node)) return node.flatMap(flatten);
    return node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node];
  }
  const component = flatten(panel).find(n => typeof n?.type === 'function' && n.type.name === 'Panel');
  assert(component, 'Settings panel was inserted');
  const tree = component.type(component.props);
  return {nodes: flatten(tree), patches};
}

(async () => {
  const view = render({tags_enabled: true, tags__automatic: true});
  const texts = view.nodes.filter(n => typeof n === 'string');
  assert(texts.some(t => t.includes('What do you want to copy?')));
  const inputs = view.nodes.filter(n => n?.type === 'input' && n.props.type === 'checkbox');
  assert(inputs.every(n => typeof n.props.checked === 'boolean'));
  const buttons = view.nodes.filter(n => n?.type === 'button');
  const preset = buttons.find(n => n.props.children.includes('Set performer copying: Gallery → Images'));
  await preset.props.onClick();
  assert.equal(JSON.stringify(view.patches[0]), JSON.stringify({links_enabled:true,links__automatic:true,links__galleryToImages:true,links__imagesToGallery:false}));
  assert(!('tags__automatic' in view.patches[0]));
  assert(!('links__galleryStudio' in view.patches[0]));
  await buttons.find(n => n.props.children.includes('Turn off automatic tag copying')).props.onClick();
  assert.equal(JSON.stringify(view.patches[1]), JSON.stringify({tags__automatic:false}));
  const routeLabels = view.nodes.filter(n => n?.type === 'label');
  const down = routeLabels.find(n => n.props.children.includes('Copy performers - Gallery to its images'));
  const up = routeLabels.find(n => n.props.children.includes('Copy performers - Images to their galleries'));
  assert.equal(down.props.children[0].props.checked, true);
  assert.equal(up.props.children[0].props.checked, false);
  await up.props.children[0].props.onChange({target:{checked:true}});
  assert.equal(JSON.stringify(view.patches[2]), JSON.stringify({links__imagesToGallery:true}));
  const configured = render({links__galleryToImages:false,links__imagesToGallery:true});
  const labels = configured.nodes.filter(n => n?.type === 'label');
  assert.equal(labels.find(n => n.props.children.includes('Copy performers - Gallery to its images')).props.children[0].props.checked,false);
  assert.equal(labels.find(n => n.props.children.includes('Copy performers - Images to their galleries')).props.children[0].props.checked,true);
  console.log('Transfer settings: render, preset scope, tag pause, defaults and individual controls passed.');
})().catch(error => {console.error(error);process.exitCode=1;});
