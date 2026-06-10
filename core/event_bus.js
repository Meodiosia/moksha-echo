// game/core/event_bus.js
// Tiny dependency-free pub/sub. ~50 LOC.
(function (root) {
  'use strict';

  var map = Object.create(null); // name -> [fn, fn, ...]

  function on(name, fn) {
    if (typeof fn !== 'function') return function () {};
    (map[name] || (map[name] = [])).push(fn);
    return function off() { _remove(name, fn); };
  }

  function once(name, fn) {
    var unsub = on(name, function wrap() {
      unsub();
      fn.apply(null, arguments);
    });
    return unsub;
  }

  function off(name, fn) { _remove(name, fn); }

  function _remove(name, fn) {
    var arr = map[name]; if (!arr) return;
    for (var i = arr.length - 1; i >= 0; i--) if (arr[i] === fn) arr.splice(i, 1);
    if (!arr.length) delete map[name];
  }

  function emit(name) {
    var arr = map[name]; if (!arr || !arr.length) return;
    var args = new Array(arguments.length - 1);
    for (var i = 1; i < arguments.length; i++) args[i - 1] = arguments[i];
    var snapshot = arr.slice(); // tolerate off() during emit
    for (var j = 0; j < snapshot.length; j++) {
      try { snapshot[j].apply(null, args); }
      catch (e) { (root.console || {}).error && console.error('[Events] handler error for', name, e); }
    }
  }

  function clear(name) {
    if (name == null) { for (var k in map) delete map[k]; }
    else delete map[name];
  }

  root.Events = { on: on, once: once, off: off, emit: emit, clear: clear };
})(typeof window !== 'undefined' ? window : globalThis);
