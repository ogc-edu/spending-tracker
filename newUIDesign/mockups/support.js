// Minimal renderer for the *.dc.html mockups (sc-for / sc-if / {{expr}} / onClick).
// URL params: ?theme=light|dark  &state={"key":value}  (merged into the component's initial state).
(function () {
  const params = new URLSearchParams(location.search);
  document.documentElement.dataset.theme = params.get('theme') === 'light' ? 'light' : 'dark';

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { Object.assign(this.state, patch); window.__dcRender(); }
  }
  window.DCLogic = DCLogic;

  function lookup(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    return expr.split('.').reduce((v, k) => (v == null ? undefined : v[k]), scope);
  }
  const whole = /^\{\{([^}]+)\}\}$/;
  const interp = (s, scope) => s.replace(/\{\{([^}]+)\}\}/g, (_, e) => {
    const v = lookup(e, scope);
    return v == null ? '' : String(v);
  });

  function build(node, scope, out) {
    if (node.nodeType === Node.TEXT_NODE) { out.appendChild(document.createTextNode(interp(node.textContent, scope))); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const list = lookup(node.getAttribute('list').match(whole)[1], scope) || [];
      const as = node.getAttribute('as');
      list.forEach((item) => node.childNodes.forEach((c) => build(c, { ...scope, [as]: item }, out)));
      return;
    }
    if (tag === 'sc-if') {
      if (lookup(node.getAttribute('value').match(whole)[1], scope)) node.childNodes.forEach((c) => build(c, scope, out));
      return;
    }
    const el = document.createElementNS(node.namespaceURI, node.localName);
    for (const { name, value } of Array.from(node.attributes)) {
      const m = value.match(whole);
      if (/^on[a-z]+$/i.test(name) && m) {
        const fn = lookup(m[1], scope);
        if (typeof fn === 'function') el.addEventListener(name.slice(2).toLowerCase(), (ev) => { ev.preventDefault(); fn(); });
      } else {
        el.setAttribute(name, interp(value, scope));
      }
    }
    node.childNodes.forEach((c) => build(c, scope, el));
    out.appendChild(el);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const host = document.querySelector('x-dc');
    const helmet = host.querySelector('helmet');
    if (helmet) { Array.from(helmet.children).forEach((c) => document.head.appendChild(c)); helmet.remove(); }
    const tpl = document.createElement('div');
    tpl.innerHTML = host.innerHTML;
    host.innerHTML = '';
    const src = document.querySelector('script[type="text/x-dc"]');
    const Component = new Function('DCLogic', src.textContent + '\nreturn Component;')(DCLogic);
    const comp = new Component({});
    const init = params.get('state');
    if (init) Object.assign(comp.state, JSON.parse(init));
    window.__dcRender = () => {
      const vals = comp.renderVals();
      const frag = document.createDocumentFragment();
      tpl.childNodes.forEach((c) => build(c, vals, frag));
      host.replaceChildren(frag);
      // Keep the chosen theme when following links between mockups.
      host.querySelectorAll('a[href$=".dc.html"]').forEach((a) => {
        a.setAttribute('href', a.getAttribute('href') + '?theme=' + document.documentElement.dataset.theme);
      });
    };
    window.__dcRender();
  });
})();
