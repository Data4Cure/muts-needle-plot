require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var events = require("backbone-events-standalone");

events.onAll = function(callback,context){
  this.on("all", callback,context);
  return this;
};

// Mixin utility
events.oldMixin = events.mixin;
events.mixin = function(proto) {
  events.oldMixin(proto);
  // add custom onAll
  var exports = ['onAll'];
  for(var i=0; i < exports.length;i++){
    var name = exports[i];
    proto[name] = this[name];
  }
  return proto;
};

module.exports = events;

},{"backbone-events-standalone":3}],2:[function(require,module,exports){
/**
 * Standalone extraction of Backbone.Events, no external dependency required.
 * Degrades nicely when Backone/underscore are already available in the current
 * global context.
 *
 * Note that docs suggest to use underscore's `_.extend()` method to add Events
 * support to some given object. A `mixin()` method has been added to the Events
 * prototype to avoid using underscore for that sole purpose:
 *
 *     var myEventEmitter = BackboneEvents.mixin({});
 *
 * Or for a function constructor:
 *
 *     function MyConstructor(){}
 *     MyConstructor.prototype.foo = function(){}
 *     BackboneEvents.mixin(MyConstructor.prototype);
 *
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * (c) 2013 Nicolas Perriault
 */
/* global exports:true, define, module */
(function() {
  var root = this,
      nativeForEach = Array.prototype.forEach,
      hasOwnProperty = Object.prototype.hasOwnProperty,
      slice = Array.prototype.slice,
      idCounter = 0;

  // Returns a partial implementation matching the minimal API subset required
  // by Backbone.Events
  function miniscore() {
    return {
      keys: Object.keys || function (obj) {
        if (typeof obj !== "object" && typeof obj !== "function" || obj === null) {
          throw new TypeError("keys() called on a non-object");
        }
        var key, keys = [];
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            keys[keys.length] = key;
          }
        }
        return keys;
      },

      uniqueId: function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
      },

      has: function(obj, key) {
        return hasOwnProperty.call(obj, key);
      },

      each: function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
          obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
          for (var i = 0, l = obj.length; i < l; i++) {
            iterator.call(context, obj[i], i, obj);
          }
        } else {
          for (var key in obj) {
            if (this.has(obj, key)) {
              iterator.call(context, obj[key], key, obj);
            }
          }
        }
      },

      once: function(func) {
        var ran = false, memo;
        return function() {
          if (ran) return memo;
          ran = true;
          memo = func.apply(this, arguments);
          func = null;
          return memo;
        };
      }
    };
  }

  var _ = miniscore(), Events;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Mixin utility
  Events.mixin = function(proto) {
    var exports = ['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo',
                   'listenToOnce', 'bind', 'unbind'];
    _.each(exports, function(name) {
      proto[name] = this[name];
    }, this);
    return proto;
  };

  // Export Events as BackboneEvents depending on current context
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Events;
    }
    exports.BackboneEvents = Events;
  }else if (typeof define === "function"  && typeof define.amd == "object") {
    define(function() {
      return Events;
    });
  } else {
    root.BackboneEvents = Events;
  }
})(this);

},{}],3:[function(require,module,exports){
module.exports = require('./backbone-events-standalone');

},{"./backbone-events-standalone":2}],4:[function(require,module,exports){
// d3.tip
// Copyright (c) 2013 Justin Palmer
//
// Tooltips for d3.js SVG visualizations

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module with d3 as a dependency.
    define(['d3'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = function(d3) {
      d3.tip = factory(d3)
      return d3.tip
    }
  } else {
    // Browser global.
    root.d3.tip = factory(root.d3)
  }
}(this, function (d3) {

  // Public - contructs a new tooltip
  //
  // Returns a tip
  return function() {
    var direction = d3_tip_direction,
        offset    = d3_tip_offset,
        html      = d3_tip_html,
        node      = initNode(),
        svg       = null,
        point     = null,
        target    = null

    function tip(vis) {
      svg = getSVGNode(vis)
      point = svg.createSVGPoint()
      document.body.appendChild(node)
    }

    // Public - show the tooltip on the screen
    //
    // Returns a tip
    tip.show = function() {
      var args = Array.prototype.slice.call(arguments)
      if(args[args.length - 1] instanceof SVGElement) target = args.pop()

      var content = html.apply(this, args),
          poffset = offset.apply(this, args),
          dir     = direction.apply(this, args),
          nodel   = d3.select(node),
          i       = directions.length,
          coords,
          scrollTop  = document.documentElement.scrollTop || document.body.scrollTop,
          scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft

      nodel.html(content)
        .style({ opacity: 1, 'pointer-events': 'all' })

      while(i--) nodel.classed(directions[i], false)
      coords = direction_callbacks.get(dir).apply(this)
      nodel.classed(dir, true).style({
        top: (coords.top +  poffset[0]) + scrollTop + 'px',
        left: (coords.left + poffset[1]) + scrollLeft + 'px'
      })

      return tip
    }

    // Public - hide the tooltip
    //
    // Returns a tip
    tip.hide = function() {
      var nodel = d3.select(node)
      nodel.style({ opacity: 0, 'pointer-events': 'none' })
      return tip
    }

    // Public: Proxy attr calls to the d3 tip container.  Sets or gets attribute value.
    //
    // n - name of the attribute
    // v - value of the attribute
    //
    // Returns tip or attribute value
    tip.attr = function(n, v) {
      if (arguments.length < 2 && typeof n === 'string') {
        return d3.select(node).attr(n)
      } else {
        var args =  Array.prototype.slice.call(arguments)
        d3.selection.prototype.attr.apply(d3.select(node), args)
      }

      return tip
    }

    // Public: Proxy style calls to the d3 tip container.  Sets or gets a style value.
    //
    // n - name of the property
    // v - value of the property
    //
    // Returns tip or style property value
    tip.style = function(n, v) {
      if (arguments.length < 2 && typeof n === 'string') {
        return d3.select(node).style(n)
      } else {
        var args =  Array.prototype.slice.call(arguments)
        d3.selection.prototype.style.apply(d3.select(node), args)
      }

      return tip
    }

    // Public: Set or get the direction of the tooltip
    //
    // v - One of n(north), s(south), e(east), or w(west), nw(northwest),
    //     sw(southwest), ne(northeast) or se(southeast)
    //
    // Returns tip or direction
    tip.direction = function(v) {
      if (!arguments.length) return direction
      direction = v == null ? v : d3.functor(v)

      return tip
    }

    // Public: Sets or gets the offset of the tip
    //
    // v - Array of [x, y] offset
    //
    // Returns offset or
    tip.offset = function(v) {
      if (!arguments.length) return offset
      offset = v == null ? v : d3.functor(v)

      return tip
    }

    // Public: sets or gets the html value of the tooltip
    //
    // v - String value of the tip
    //
    // Returns html value or tip
    tip.html = function(v) {
      if (!arguments.length) return html
      html = v == null ? v : d3.functor(v)

      return tip
    }

    function d3_tip_direction() { return 'n' }
    function d3_tip_offset() { return [0, 0] }
    function d3_tip_html() { return ' ' }

    var direction_callbacks = d3.map({
      n:  direction_n,
      s:  direction_s,
      e:  direction_e,
      w:  direction_w,
      nw: direction_nw,
      ne: direction_ne,
      sw: direction_sw,
      se: direction_se
    }),

    directions = direction_callbacks.keys()

    function direction_n() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.n.y - node.offsetHeight,
        left: bbox.n.x - node.offsetWidth / 2
      }
    }

    function direction_s() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.s.y,
        left: bbox.s.x - node.offsetWidth / 2
      }
    }

    function direction_e() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.e.y - node.offsetHeight / 2,
        left: bbox.e.x
      }
    }

    function direction_w() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.w.y - node.offsetHeight / 2,
        left: bbox.w.x - node.offsetWidth
      }
    }

    function direction_nw() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.nw.y - node.offsetHeight,
        left: bbox.nw.x - node.offsetWidth
      }
    }

    function direction_ne() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.ne.y - node.offsetHeight,
        left: bbox.ne.x
      }
    }

    function direction_sw() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.sw.y,
        left: bbox.sw.x - node.offsetWidth
      }
    }

    function direction_se() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.se.y,
        left: bbox.e.x
      }
    }

    function initNode() {
      var node = d3.select(document.createElement('div'))
      node.style({
        position: 'absolute',
        top: 0,
        opacity: 0,
        'pointer-events': 'none',
        'box-sizing': 'border-box'
      })

      return node.node()
    }

    function getSVGNode(el) {
      el = el.node()
      if(el.tagName.toLowerCase() === 'svg')
        return el

      return el.ownerSVGElement
    }

    // Private - gets the screen coordinates of a shape
    //
    // Given a shape on the screen, will return an SVGPoint for the directions
    // n(north), s(south), e(east), w(west), ne(northeast), se(southeast), nw(northwest),
    // sw(southwest).
    //
    //    +-+-+
    //    |   |
    //    +   +
    //    |   |
    //    +-+-+
    //
    // Returns an Object {n, s, e, w, nw, sw, ne, se}
    function getScreenBBox() {
      var targetel   = target || d3.event.target;

      while ('undefined' === typeof targetel.getScreenCTM && 'undefined' === targetel.parentNode) {
          targetel = targetel.parentNode;
      }

      var bbox       = {},
          matrix     = targetel.getScreenCTM(),
          tbbox      = targetel.getBBox(),
          width      = tbbox.width,
          height     = tbbox.height,
          x          = tbbox.x,
          y          = tbbox.y

      point.x = x
      point.y = y
      bbox.nw = point.matrixTransform(matrix)
      point.x += width
      bbox.ne = point.matrixTransform(matrix)
      point.y += height
      bbox.se = point.matrixTransform(matrix)
      point.x -= width
      bbox.sw = point.matrixTransform(matrix)
      point.y -= height / 2
      bbox.w  = point.matrixTransform(matrix)
      point.x += width
      bbox.e = point.matrixTransform(matrix)
      point.x -= width / 2
      point.y -= height / 2
      bbox.n = point.matrixTransform(matrix)
      point.y += height
      bbox.s = point.matrixTransform(matrix)

      return bbox
    }

    return tip
  };

}));

},{}],5:[function(require,module,exports){
/**
 *
 * Mutations Needle Plot (muts-needle-plot)
 *
 * Creates a needle plot (a.k.a stem plot, lollipop-plot and soon also balloon plot ;-)
 * This class uses the npm-require module to load dependencies d3, d3-tip
 *
 * @author Michael P Schroeder
 * @class
 */

function MutsNeedlePlot (config) {

    // INITIALIZATION

    var self = this;        // self = MutsNeedlePlot

    // X-coordinates
    this.maxCoord = config.maxCoord || -1;             // The maximum coord (x-axis)
    if (this.maxCoord < 0) { throw new Error("'maxCoord' must be defined initiation config!"); }
    this.minCoord = config.minCoord || 1;               // The minimum coord (x-axis)

    // data
    var mutationData = config.mutationData || -1;          // .json file or dict
    if (this.maxCoord < 0) { throw new Error("'mutationData' must be defined initiation config!"); }
    var regionData = config.regionData || -1;              // .json file or dict
    if (this.maxCoord < 0) { throw new Error("'regionData' must be defined initiation config!"); }
    this.totalCategCounts = {};
    this.categCounts = {};
    this.selectedNeedles = [];

    // Plot dimensions & target
    var targetElement = document.getElementById(config.targetElement) || config.targetElement || document.body   // Where to append the plot (svg)

    var width = this.width = config.width || targetElement.offsetWidth || 1000;
    var height = this.height = config.height || targetElement.offsetHeight || 500;

    // Color scale & map
    this.colorMap = config.colorMap || {};              // dict
    var colors = Object.keys(this.colorMap).map(function (key) {
        return self.colorMap[key];
    });
    this.colorScale = d3.scale.category20()
        .domain(Object.keys(this.colorMap))
        .range(colors.concat(d3.scale.category20().range()));
    this.legends = config.legends || {
        "y": "Value",
        "x": "Coordinate"
    };

    this.svgClasses = "mutneedles";
    this.buffer = 0;

    var maxCoord = this.maxCoord;

    var buffer = 0;
    if (width >= height) {
      buffer = height / 8;
    } else {
      buffer = width / 8;
    }

    this.buffer = buffer;

    // IIMPORT AND CONFIGURE TIPS
    var d3tip = require('d3-tip');
    d3tip(d3);

    var needleTip = config.needleTip ||
        function(d) {
            return "<span>" + d.value + " " + d.category +  " at coord. " + d.coordString + "</span>";
        }

    var selectionTip = config.selectionTip ||
        function(d) {
            return "<span> Selected coordinates<br/>" + Math.round(d.left) + " - " + Math.round(d.right) + "</span>";
        }

    var regionTip = config.regionTip ||
        function(d) {
            return "<span>" + d.name + "</span>";
        }


    this.tip = d3.tip()
      .attr('class', 'muts-needle-plot d3-tip d3-tip-needle')
      .offset([-10, 0])
      .html(needleTip);

    this.selectionTip = d3.tip()
        .attr('class', 'muts-needle-plot d3-tip d3-tip-selection')
        .offset([-50, 0])
        .html(selectionTip)
        .direction('n');

    this.regionTip = d3.tip()
        .attr('class', 'muts-needle-plot d3-tip d3-tip-region')
        .offset([-10, 0])
        .html(regionTip)
        .direction('n');

    // INIT SVG
    var svg;
    var topnode;
    if (config.responsive == 'resize') {
        topnode  = d3.select(targetElement).append("svg")
            .attr("width", '100%')
            .attr("height", '100%')
            .attr('viewBox','0 0 '+Math.min(width)+' '+Math.min(height))
            .attr('class', 'brush');
        svg = topnode
            .append("g")
            .attr("class", this.svgClasses)
            .attr("transform", "translate(0,0)");
    } else  {

        svg = d3.select(targetElement).append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("class", this.svgClasses + " brush");
        topnode = svg;
    }


    svg.call(this.tip);
    svg.call(this.selectionTip);
    svg.call(this.regionTip);

    // DEFINE SCALES

    this.segments = config.segments

    var x
    if (config.segments) {
        x = segmentedDomain(config.segments,
                            0.1,
                            buffer,
                            width);
    }
    else {
        x = d3.scale.linear()
            .domain([this.minCoord, this.maxCoord])
            .range([buffer * 1.5 , width - buffer])
            .nice();
    }


    this.x = x;

    var y = d3.scale.linear()
      .domain([1,20])
      .range([height - buffer * 1.5, buffer])
      .nice();
    this.y = y;

    // CONFIGURE BRUSH
    self.selector = d3.svg.brush()
        .x(x)
        .on("brush", brushmove)
        .on("brushend", brushend);
    var selector = self.selector;

    var selectionRect = topnode
        .call(selector)
        .selectAll('.extent')
        .attr('height', 50)
        .attr('y', height-50)
        .attr('opacity', 0.2);

    selectionRect.on("mouseenter", function() {
        var selection = selector.extent();
        self.selectionTip.show({left: selection[0], right: selection[1]}, selectionRect.node());
    })
        .on("mouseout", function(){
            //d3.select(".d3-tip-selection")
            self.selectionTip
                //.transition()
                //.delay(3000)
                //.duration(1000)
                .style("opacity",0)
                .style('pointer-events', 'none');
        });

    function selectionDetails() {
        var extent = selector.extent();
        var needleHeads = svg.selectAll(".needle-head");
        var selectedNeedles = [];
        var categCounts = {};
        for (key in Object.keys(self.totalCategCounts)) {
            categCounts[key] = 0;
        }

        needleHeads.classed("selected", function(d) {
            is_brushed = extent[0] <= d.coord && d.coord <= extent[1];
            if (is_brushed) {
                selectedNeedles.push(d);
                categCounts[d.category] = (categCounts[d.category] || 0) + d.value;
            }
            return is_brushed;
        });

        return {
            selected: selectedNeedles,
            categCounts: categCounts,
            coords: extent,
        }
    }

    function brushmove() {
        self.trigger('needleSelectionChange',
                     selectionDetails());
    }

    function brushend() {
        //get_button = d3.select(".clear-button");
        self.trigger('needleSelectionChangeEnd',
                     selectionDetails());
    }

    /// DRAW
    this.drawNeedles(svg, mutationData, regionData, config.noRegionLabels);


    self.on("needleSelectionChange", function (edata) {
        self.categCounts = edata.categCounts;
        self.selectedNeedles = edata.selected;
        svg.call(self.verticalLegend);
    });

    self.on("needleSelectionChangeEnd", function (edata) {
        self.categCounts = edata.categCounts;
        self.selectedNeedles = edata.selected;
        svg.call(self.verticalLegend);
    });

    self.on("needleSelectionChange", function(edata) {
        var selection = edata.coords;
        if (selection[1] - selection[0] > 0) {
            self.selectionTip.show({left: selection[0], right: selection[1]}, selectionRect.node());
            //d3.select(".d3-tip-selection")
            self.selectionTip
                //.transition()
                //.delay(3000)
                //.aduration(1000)
                .style("opacity",0)
                .style('pointer-events', 'none');
        } else {
            self.selectionTip.hide();
        }
    });

}

//segmentedDomain([ { minCoord: 1000, maxCoord: 1010 } ], 0, 100, 1000)
//segmentedDomain([ { minCoord: 1000, maxCoord: 1010 }, { minCoord: 2000, maxCoord: 2050 }, { minCoord: 60000, maxCoord: 60030 } ], 0, 100, 1000)
//segmentedDomain([ { minCoord: 1000, maxCoord: 1010 } ], 0.1, 100, 1000)
//segmentedDomain([ { minCoord: 1000, maxCoord: 1010 }, { minCoord: 2000, maxCoord: 2050 }, { minCoord: 60000, maxCoord: 60030 } ], 0.1, 100, 1000)
function segmentedDomain(segments, padding, buffer, width) {
    // padding - fraction of the domain used as segment separators
    if (segments.length <= 1) {
        padding = 0
    }
    var lens = _.map(
        segments,
        function(s) {
            return s.maxCoord - s.minCoord + 1
        }
    )
    var cumm_lens = _.reduce(
        lens,
        function(m, l) {
            m.push(m[m.length - 1] + l)
            return m
        },
        [0]
    )
    var vs = _.map(
        cumm_lens,
        function(l) {
            return l * (1 - padding) / cumm_lens[cumm_lens.length - 1]
        }
    )
    var sep = padding / (segments.length - 1)
    var domain = []
    var ws = []
    vs.forEach(function(v, k) {
        if (k !== 0) {
            domain.push(segments[k - 1].minCoord)
            domain.push(segments[k - 1].maxCoord)
            ws.push((k - 1) * sep + vs[k - 1])
            ws.push((k - 1) * sep + v)
        }
    })
    var f = d3.scale.linear()
        .range([buffer * 1.5 , width - buffer])
    var range = _.map(ws, f)
    // console.log('segmentedDomain', {
    //     lens: lens,
    //     cumm_lens: cumm_lens,
    //     vs: vs,
    //     sep: sep,
    //     domain: domain,
    //     ws: ws,
    //     range: range,
    // })
    return d3.scale.linear()
        .domain(domain)
        .range(range)
        //.nice()
}

MutsNeedlePlot.prototype.drawLegend = function(svg) {

    // LEGEND
    var self = this;

    // prepare legend categories (correct order)
    var mutCategories = [];
    var categoryColors = [];
    var allcategs = Object.keys(self.totalCategCounts); // random order
    var orderedDeclaration = self.colorScale.domain();  // wanted order
    var idx
    for (idx in orderedDeclaration) {
        var c = orderedDeclaration[idx];
        if (allcategs.indexOf(c) > -1) {
            mutCategories.push(c);
            categoryColors.push(self.colorScale(c))
        }
    }

    // create scale with correct order of categories
    var mutsScale = self.colorScale.domain(mutCategories).range(categoryColors);


    var domain = self.x.domain();
    var xplacement = (self.x(domain[1]) - self.x(domain[0])) * 0.75 + self.x(domain[0]);


    var sum = 0;
    for (var c in self.totalCategCounts) {
        sum += self.totalCategCounts[c];
    }

    var legendLabel = function(categ) {
        var count = (self.categCounts[categ] || (self.selectedNeedles.length == 0 && self.totalCategCounts[categ]) || 0);
        return categ + (count > 0 ? ": "+count+" (" + Math.round(count/sum*100) + "%)" : "");
    };

    var legendClass = function(categ) {
        var count = (self.categCounts[categ] || (self.selectedNeedles.length == 0 && self.totalCategCounts[categ]) || 0);
        return (count > 0) ? "" : "nomuts";
    };

    self.noshow = [];
    var needleHeads = svg.selectAll(".needle-head");
    var showNoShow = function(categ){
        if (_.contains(self.noshow, categ)) {
            self.noshow = _.filter(self.noshow, function(s) { return s != categ });
        } else {
            self.noshow.push(categ);
        }
        needleHeads.classed("noshow", function(d) {
            return _.contains(self.noshow, d.category);
        });
        var legendCells = svg.selectAll("g.legendCells");
        legendCells.classed("noshow", function(d) {
            return _.contains(self.noshow, d.stop[0]);
        });
    };


    var verticalLegend = d3.svg.legend()
        .labelFormat(legendLabel)
        .labelClass(legendClass)
        .onLegendClick(showNoShow)
        .cellPadding(4)
        .orientation("vertical")
        .units(sum + " Mutations")
        .cellWidth(20)
        .cellHeight(12)
        .inputScale(mutsScale)
        .cellStepping(4)
        .place({x: xplacement, y: 50});

    self.verticalLegend = verticalLegend

    svg.call(verticalLegend);

};

MutsNeedlePlot.prototype.drawRegions = function(svg, regionData, noRegionLabels) {

    var maxCoord = this.maxCoord;
    var minCoord = this.minCoord;
    var buffer = this.buffer;
    var colors = this.colorMap;
    var y = this.y;
    var x = this.x;

    var below = true;

    var regionTip = this.regionTip;

    getRegionStart = function(region) {
        return parseInt(region.split("-")[0])
    };

    getRegionEnd = function(region) {
        return parseInt(region.split("-")[1])
    };

    getColor = this.colorScale;

    var bg_offset = 0;
    var region_offset = bg_offset-3
    var text_offset = bg_offset + 20;
    if (below != true) {
        text_offset = bg_offset+5;
    }

    function draw(regionList) {

        var regionsBG = svg.selectAll() // d3.select(".mutneedles").selectAll()
            .data(["dummy"]).enter()
            .insert("g", ":first-child")
            .attr("class", "regionsBG")
            .append("rect")
            .attr("x", x(minCoord) )
            .attr("y", y(0) + bg_offset )
            .attr("width", x(maxCoord) - x(minCoord) )
            .attr("height", 10)
            .attr("fill", "lightgrey");


        svg.select(".extent") // d3.select(".extent")
            .attr("y", y(0) + region_offset - 10);


        var regions = regionsBG = svg.selectAll() // d3.select(".mutneedles").selectAll()
            .data(regionList)
            .enter()
            .append("g")
            .attr("class", "regionGroup");

        regions.append("rect")
            .attr("x", function (r) {
                return x(r.start);
            })
            .attr("y", y(0) + region_offset )
            .attr("ry", "3")
            .attr("rx", "3")
            .attr("width", function (r) {
                return x(r.end) - x(r.start)
            })
            .attr("height", 16)
            .style("fill", function (data) {
                return data.color
            })
            .style("stroke", function (data) {
                return d3.rgb(data.color).darker()
            })
            .on('mouseover',  function(d){ d3.select(this).moveToFront(); regionTip.show(d); })
            .on('mouseout', regionTip.hide);

        regions
            .attr('pointer-events', 'all')
            .attr('cursor', 'pointer')
            .on("click",  function(r) {
            // set custom selection extent
            self.selector.extent([r.start, r.end]);
            // call the extent to change with transition
            //self.selector(d3.select(".brush").transition());
            self.selector(svg.transition()); // svg always has class 'brush'?
            // call extent (selection) change listeners
            //self.selector.event(d3.select(".brush").transition().delay(300));
            self.selector(svg.transition().delay(300)); // svg always has class 'brush'?

        });

        if (!noRegionLabels) {
            // Place and label location
            var labels = [];

            var repeatedRegion = {};
            var getRegionClass = function(region) {
                var c = "regionName";
                var repeatedClass = "RR_"+region.name;
                if(_.has(repeatedRegion, region.name)) {
                    c = "repeatedName noshow " + repeatedClass;
                }
                repeatedRegion[region.name] = repeatedClass;
                return c;
            };
            regions.append("text")
                .attr("class", getRegionClass)
                .attr("text-anchor", "middle")
                .attr("fill", "black")
                .attr("opacity", 0.5)
                .attr("x", function (r) {
                    r.x = x(r.start) + (x(r.end) - x(r.start)) / 2;
                    return r.x;
                })
                .attr("y", function(r) {r.y = y(0) + text_offset; return r.y; } )
                .attr("dy", "0.35em")
                .style("font-size", "12px")
                .style("text-decoration", "bold")
                .text(function (data) {
                    return data.name
                });

            var regionNames = svg.selectAll(".regionName"); // d3.selectAll(".regionName");
            regionNames.each(function(d, i) {
                var interactionLength = this.getBBox().width / 2;
                labels.push({x: d.x, y: d.y, label: d.name, weight: d.name.length, radius: interactionLength});
            });

            var force = d3.layout.force()
                .chargeDistance(5)
                .nodes(labels)
                .charge(-10)
                .gravity(0);

            var minX = x(minCoord);
            var maxX = x(maxCoord);
            var withinBounds = function(x) {
                return d3.min([
                    d3.max([
                        minX,
                        x]),
                    maxX
                ]);
            };
            function collide(node) {
                var r = node.radius + 3,
                    nx1 = node.x - r,
                    nx2 = node.x + r,
                    ny1 = node.y - r,
                    ny2 = node.y + r;
                return function(quad, x1, y1, x2, y2) {
                    if (quad.point && (quad.point !== node)) {
                        var l = node.x - quad.point.x,
                            x = l;
                        r = node.radius + quad.point.radius;
                        if (Math.abs(l) < r) {
                            l = (l - r) / l * .005;
                            x *= l;
                            x =  (node.x > quad.point.x && x < 0) ? -x : x;
                            node.x += x;
                            quad.point.x -= x;
                        }
                    }
                    return x1 > nx2
                        || x2 < nx1
                        || y1 > ny2
                        || y2 < ny1;
                };
            }
            var moveRepeatedLabels = function(label, x) {
                var name = repeatedRegion[label];
                svg.selectAll("text."+name)
                    .attr("x", newx);
            };
            force.on("tick", function(e) {
                var q = d3.geom.quadtree(labels),
                    i = 0,
                    n = labels.length;
                while (++i < n) {
                    q.visit(collide(labels[i]));
                }
                // Update the position of the text element
                var i = 0;
                svg.selectAll("text.regionName")
                    .attr("x", function(d) {
                        newx = labels[i++].x;
                        moveRepeatedLabels(d.name, newx);
                        return newx;
                    }
                         );
            });
            force.start();
        }
    }

    function formatRegions(regions) {
        for (key in Object.keys(regions)) {

            regions[key].start = getRegionStart(regions[key].coord);
            regions[key].end = getRegionEnd(regions[key].coord);
            if (regions[key].start == regions[key].end) {
                regions[key].start -= 0.4;
                regions[key].end += 0.4;
            }
            regions[key].color = getColor(regions[key].name);
            /*regionList.push({
                'name': key,
                'start': getRegionStart(regions[key]),
                'end': getRegionEnd(regions[key]),
                'color': getColor(key)
            });*/
        }
        return regions;
    }

    if (typeof regionData == "string") {
        // assume data is in a file
        d3.json(regionData, function(error, regions) {
            if (error) {return console.debug(error)}
            regionList = formatRegions(regions);
            draw(regionList);
        });
    } else {
        regionList = formatRegions(regionData);
        draw(regionList);
    }

};


MutsNeedlePlot.prototype.drawAxes = function(svg) {

    var y = this.y;
    var x = this.x;

    xAxis = d3.svg.axis().scale(x).orient("bottom");

    if (this.segments) {
        xAxis.tickValues(
            _.map(
                d3.scale.linear().domain([
                    x(this.minCoord),
                    x(this.maxCoord),
                ]).ticks(),
                // _.range(
                //     x(this.minCoord),
                //     x(this.maxCoord),
                //     (x(this.maxCoord) - x(this.minCoord)) / 8
                // ),
                function(v) {
                    return Math.round(x.invert(v))
                }
            )
        )
        console.log('tickValues', xAxis, this)
    }

    svg.append("svg:g")
      .attr("class", "x-axis axis")
      .attr("transform", "translate(0," + (this.height - this.buffer) + ")")
      .call(xAxis);

    yAxis = d3.svg.axis().scale(y).orient("left");


    svg.append("svg:g")
      .attr("class", "y-axis axis")
      .attr("transform", "translate(" + (this.buffer * 1.2 + - 10)  + ",0)")
      .call(yAxis);

    // appearance for x and y legend
    svg.selectAll(".axis path")
        .attr('fill', 'none');
    svg.selectAll(".domain")
        .attr('stroke', 'black')
        .attr('stroke-width', 1);

    svg.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", "translate(" + (this.buffer / 3) + "," + (this.height / 2) + "), rotate(-90)")
        .text(this.legends.y)
        .attr('font-weight', 'bold')
        .attr('font-size', 12);

    svg.append("text")
          .attr("class", "x-label")
          .attr("text-anchor", "middle")
          .attr("transform", "translate(" + (this.width / 2) + "," + (this.height - this.buffer / 3) + ")")
          .text(this.legends.x)
        .attr('font-weight', 'bold')
        .attr('font-size', 12);
    
};



MutsNeedlePlot.prototype.drawNeedles = function(svg, mutationData, regionData, noRegionLabels) {

    var y = this.y;
    var x = this.x;
    var self = this;

    var getYAxis = function() {
        return y;
    };

    var formatCoord = function(coord) {
       if (coord.indexOf("-") > -1) {
           coords = coord.split("-");

           // place neede at middle of affected region
           coord = Math.floor((parseInt(coords[0]) + parseInt(coords[1])) / 2);

           // check for splice sites: "?-9" or "9-?"
           if (isNaN(coord)) {
               if (coords[0] == "?") { coord = parseInt(coords[1]) }
               else if (coords [1] == "?") { coord = parseInt(coords[0]) }
           }
        } else {
            coord = parseInt(coord);
        }
        return coord;
    };

    var tip = this.tip;

    // stack needles at same pos
    var needlePoint = {};
    var highest = 0;

    var stackNeedle = function(pos, value, pointDict) {
        var stickHeight = 0;
        pos = 'p' + String(pos);
        if (pos in pointDict) {
            stickHeight = pointDict[pos];
            newHeight = stickHeight + value;
            pointDict[pos] = newHeight;
        } else {
            pointDict[pos] = value;
        }
        return stickHeight;
    };

    function formatMutationEntry(d) {

        var coordString = d.coord;
        var numericCoord = formatCoord(d.coord);
        var numericValue = Number(d.value);
        var stickHeight = stackNeedle(numericCoord, numericValue, needlePoint);
        var category = d.category || "other";

        if (stickHeight + numericValue > highest) {
            // set Y-Axis always to highest available
            highest = stickHeight + numericValue;
            getYAxis().domain([0, highest + 2]);
        }


        if (numericCoord > 0) {

            // record and count categories
            self.totalCategCounts[category] = (self.totalCategCounts[category] || 0) + numericValue;

            return {
                category: category,
                coordString: coordString,
                coord: numericCoord,
                value: numericValue,
                stickHeight: stickHeight,
                color: self.colorScale(category),
                data: d.data,
            }
        } else {
            console.debug("discarding " + d.coord + " " + d.category + "("+ numericCoord +")");
        }
    }

    var muts
    if (typeof mutationData == "string") {
        d3.json(mutationData, function(error, unformattedMuts) {
            if (error) {
                 throw new Error(error);
            }
            muts = prepareMuts(unformattedMuts);
            paintMuts(muts);
        });
    } else {
        muts = prepareMuts(mutationData);
        paintMuts(muts);
    }

    function prepareMuts(unformattedMuts) {
        var muts = []
        var key
        for (key in unformattedMuts) {
            var formatted = formatMutationEntry(unformattedMuts[key]);
            if (formatted != undefined) {
                muts.push(formatted);
            }
        }
        return muts;
    }


    function paintMuts(muts) {

        var minSize = 4;
        var maxSize = 10;
        var headSizeScale = d3.scale.log().range([minSize,maxSize]).domain([1, highest/2]);
        var headSize = function(n) {
            return d3.min([d3.max([headSizeScale(n),minSize]), maxSize]);
        };

        var needles = svg.selectAll() // d3.select(".mutneedles").selectAll()
            .data(muts).enter()
            .append("line")
            .attr("y1", function(data) { return y(data.stickHeight + data.value) + headSize(data.value) ; } )
            .attr("y2", function(data) { return y(data.stickHeight) })
            .attr("x1", function(data) { return x(data.coord) })
            .attr("x2", function(data) { return x(data.coord) })
            .attr("class", "needle-line")
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        var needleHeads = svg.selectAll() // d3.select(".mutneedles").selectAll()
            .data(muts)
            .enter().append("circle")
            .attr("cy", function(data) { return y(data.stickHeight+data.value) } )
            .attr("cx", function(data) { return x(data.coord) } )
            .attr("r", function(data) { return headSize(data.value) })
            .attr("class", "needle-head")
            .style("fill", function(data) { return data.color })
            .style("stroke", function(data) {return d3.rgb(data.color).darker()})
            .on('mouseover',  function(d){ d3.select(this).moveToFront(); tip.show(d); })
            .on('mouseout', tip.hide);

        d3.selection.prototype.moveToFront = function() {
            return this.each(function(){
                this.parentNode.appendChild(this);
            });
        };

        // adjust y-scale according to highest value an draw the rest
        if (regionData != undefined) {
            self.drawRegions(svg, regionData, noRegionLabels);
        }
        self.drawLegend(svg);
        self.drawAxes(svg);

        /* Bring needle heads in front of regions */
        needleHeads.each(function() {
            this.parentNode.appendChild(this);
        });
    }

};



var Events = require('biojs-events');
Events.mixin(MutsNeedlePlot.prototype);

module.exports = MutsNeedlePlot;


},{"biojs-events":1,"d3-tip":4}],"muts-needle-plot":[function(require,module,exports){
module.exports = require("./src/js/MutsNeedlePlot.js");

},{"./src/js/MutsNeedlePlot.js":5}]},{},["muts-needle-plot"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9ib2drbHVnL2Q0Yy9tdXRzLW5lZWRsZS1wbG90L25vZGVfbW9kdWxlcy9iaW9qcy1ldmVudHMvaW5kZXguanMiLCIvaG9tZS9ib2drbHVnL2Q0Yy9tdXRzLW5lZWRsZS1wbG90L25vZGVfbW9kdWxlcy9iaW9qcy1ldmVudHMvbm9kZV9tb2R1bGVzL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lLmpzIiwiL2hvbWUvYm9na2x1Zy9kNGMvbXV0cy1uZWVkbGUtcGxvdC9ub2RlX21vZHVsZXMvYmlvanMtZXZlbnRzL25vZGVfbW9kdWxlcy9iYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZS9pbmRleC5qcyIsIi9ob21lL2JvZ2tsdWcvZDRjL211dHMtbmVlZGxlLXBsb3Qvbm9kZV9tb2R1bGVzL2QzLXRpcC9pbmRleC5qcyIsIi9ob21lL2JvZ2tsdWcvZDRjL211dHMtbmVlZGxlLXBsb3Qvc3JjL2pzL011dHNOZWVkbGVQbG90LmpzIiwiLi9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3IxQkE7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZXZlbnRzID0gcmVxdWlyZShcImJhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lXCIpO1xuXG5ldmVudHMub25BbGwgPSBmdW5jdGlvbihjYWxsYmFjayxjb250ZXh0KXtcbiAgdGhpcy5vbihcImFsbFwiLCBjYWxsYmFjayxjb250ZXh0KTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBNaXhpbiB1dGlsaXR5XG5ldmVudHMub2xkTWl4aW4gPSBldmVudHMubWl4aW47XG5ldmVudHMubWl4aW4gPSBmdW5jdGlvbihwcm90bykge1xuICBldmVudHMub2xkTWl4aW4ocHJvdG8pO1xuICAvLyBhZGQgY3VzdG9tIG9uQWxsXG4gIHZhciBleHBvcnRzID0gWydvbkFsbCddO1xuICBmb3IodmFyIGk9MDsgaSA8IGV4cG9ydHMubGVuZ3RoO2krKyl7XG4gICAgdmFyIG5hbWUgPSBleHBvcnRzW2ldO1xuICAgIHByb3RvW25hbWVdID0gdGhpc1tuYW1lXTtcbiAgfVxuICByZXR1cm4gcHJvdG87XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50cztcbiIsIi8qKlxuICogU3RhbmRhbG9uZSBleHRyYWN0aW9uIG9mIEJhY2tib25lLkV2ZW50cywgbm8gZXh0ZXJuYWwgZGVwZW5kZW5jeSByZXF1aXJlZC5cbiAqIERlZ3JhZGVzIG5pY2VseSB3aGVuIEJhY2tvbmUvdW5kZXJzY29yZSBhcmUgYWxyZWFkeSBhdmFpbGFibGUgaW4gdGhlIGN1cnJlbnRcbiAqIGdsb2JhbCBjb250ZXh0LlxuICpcbiAqIE5vdGUgdGhhdCBkb2NzIHN1Z2dlc3QgdG8gdXNlIHVuZGVyc2NvcmUncyBgXy5leHRlbmQoKWAgbWV0aG9kIHRvIGFkZCBFdmVudHNcbiAqIHN1cHBvcnQgdG8gc29tZSBnaXZlbiBvYmplY3QuIEEgYG1peGluKClgIG1ldGhvZCBoYXMgYmVlbiBhZGRlZCB0byB0aGUgRXZlbnRzXG4gKiBwcm90b3R5cGUgdG8gYXZvaWQgdXNpbmcgdW5kZXJzY29yZSBmb3IgdGhhdCBzb2xlIHB1cnBvc2U6XG4gKlxuICogICAgIHZhciBteUV2ZW50RW1pdHRlciA9IEJhY2tib25lRXZlbnRzLm1peGluKHt9KTtcbiAqXG4gKiBPciBmb3IgYSBmdW5jdGlvbiBjb25zdHJ1Y3RvcjpcbiAqXG4gKiAgICAgZnVuY3Rpb24gTXlDb25zdHJ1Y3Rvcigpe31cbiAqICAgICBNeUNvbnN0cnVjdG9yLnByb3RvdHlwZS5mb28gPSBmdW5jdGlvbigpe31cbiAqICAgICBCYWNrYm9uZUV2ZW50cy5taXhpbihNeUNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG4gKlxuICogKGMpIDIwMDktMjAxMyBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgSW5jLlxuICogKGMpIDIwMTMgTmljb2xhcyBQZXJyaWF1bHRcbiAqL1xuLyogZ2xvYmFsIGV4cG9ydHM6dHJ1ZSwgZGVmaW5lLCBtb2R1bGUgKi9cbihmdW5jdGlvbigpIHtcbiAgdmFyIHJvb3QgPSB0aGlzLFxuICAgICAgbmF0aXZlRm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LFxuICAgICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UsXG4gICAgICBpZENvdW50ZXIgPSAwO1xuXG4gIC8vIFJldHVybnMgYSBwYXJ0aWFsIGltcGxlbWVudGF0aW9uIG1hdGNoaW5nIHRoZSBtaW5pbWFsIEFQSSBzdWJzZXQgcmVxdWlyZWRcbiAgLy8gYnkgQmFja2JvbmUuRXZlbnRzXG4gIGZ1bmN0aW9uIG1pbmlzY29yZSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2V5czogT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAodHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqICE9PSBcImZ1bmN0aW9uXCIgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImtleXMoKSBjYWxsZWQgb24gYSBub24tb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXksIGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBrZXlzW2tleXMubGVuZ3RoXSA9IGtleTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICB9LFxuXG4gICAgICB1bmlxdWVJZDogZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICAgICAgfSxcblxuICAgICAgaGFzOiBmdW5jdGlvbihvYmosIGtleSkge1xuICAgICAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG4gICAgICB9LFxuXG4gICAgICBlYWNoOiBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgICAgfSBlbHNlIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhcyhvYmosIGtleSkpIHtcbiAgICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5XSwga2V5LCBvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgb25jZTogZnVuY3Rpb24oZnVuYykge1xuICAgICAgICB2YXIgcmFuID0gZmFsc2UsIG1lbW87XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAocmFuKSByZXR1cm4gbWVtbztcbiAgICAgICAgICByYW4gPSB0cnVlO1xuICAgICAgICAgIG1lbW8gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgZnVuYyA9IG51bGw7XG4gICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHZhciBfID0gbWluaXNjb3JlKCksIEV2ZW50cztcblxuICAvLyBCYWNrYm9uZS5FdmVudHNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gQSBtb2R1bGUgdGhhdCBjYW4gYmUgbWl4ZWQgaW4gdG8gKmFueSBvYmplY3QqIGluIG9yZGVyIHRvIHByb3ZpZGUgaXQgd2l0aFxuICAvLyBjdXN0b20gZXZlbnRzLiBZb3UgbWF5IGJpbmQgd2l0aCBgb25gIG9yIHJlbW92ZSB3aXRoIGBvZmZgIGNhbGxiYWNrXG4gIC8vIGZ1bmN0aW9ucyB0byBhbiBldmVudDsgYHRyaWdnZXJgLWluZyBhbiBldmVudCBmaXJlcyBhbGwgY2FsbGJhY2tzIGluXG4gIC8vIHN1Y2Nlc3Npb24uXG4gIC8vXG4gIC8vICAgICB2YXIgb2JqZWN0ID0ge307XG4gIC8vICAgICBfLmV4dGVuZChvYmplY3QsIEJhY2tib25lLkV2ZW50cyk7XG4gIC8vICAgICBvYmplY3Qub24oJ2V4cGFuZCcsIGZ1bmN0aW9uKCl7IGFsZXJ0KCdleHBhbmRlZCcpOyB9KTtcbiAgLy8gICAgIG9iamVjdC50cmlnZ2VyKCdleHBhbmQnKTtcbiAgLy9cbiAgRXZlbnRzID0ge1xuXG4gICAgLy8gQmluZCBhbiBldmVudCB0byBhIGBjYWxsYmFja2AgZnVuY3Rpb24uIFBhc3NpbmcgYFwiYWxsXCJgIHdpbGwgYmluZFxuICAgIC8vIHRoZSBjYWxsYmFjayB0byBhbGwgZXZlbnRzIGZpcmVkLlxuICAgIG9uOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ29uJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkgfHwgIWNhbGxiYWNrKSByZXR1cm4gdGhpcztcbiAgICAgIHRoaXMuX2V2ZW50cyB8fCAodGhpcy5fZXZlbnRzID0ge30pO1xuICAgICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXSB8fCAodGhpcy5fZXZlbnRzW25hbWVdID0gW10pO1xuICAgICAgZXZlbnRzLnB1c2goe2NhbGxiYWNrOiBjYWxsYmFjaywgY29udGV4dDogY29udGV4dCwgY3R4OiBjb250ZXh0IHx8IHRoaXN9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBCaW5kIGFuIGV2ZW50IHRvIG9ubHkgYmUgdHJpZ2dlcmVkIGEgc2luZ2xlIHRpbWUuIEFmdGVyIHRoZSBmaXJzdCB0aW1lXG4gICAgLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQsIGl0IHdpbGwgYmUgcmVtb3ZlZC5cbiAgICBvbmNlOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ29uY2UnLCBuYW1lLCBbY2FsbGJhY2ssIGNvbnRleHRdKSB8fCAhY2FsbGJhY2spIHJldHVybiB0aGlzO1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIG9uY2UgPSBfLm9uY2UoZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYub2ZmKG5hbWUsIG9uY2UpO1xuICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG4gICAgICBvbmNlLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgICAgcmV0dXJuIHRoaXMub24obmFtZSwgb25jZSwgY29udGV4dCk7XG4gICAgfSxcblxuICAgIC8vIFJlbW92ZSBvbmUgb3IgbWFueSBjYWxsYmFja3MuIElmIGBjb250ZXh0YCBpcyBudWxsLCByZW1vdmVzIGFsbFxuICAgIC8vIGNhbGxiYWNrcyB3aXRoIHRoYXQgZnVuY3Rpb24uIElmIGBjYWxsYmFja2AgaXMgbnVsbCwgcmVtb3ZlcyBhbGxcbiAgICAvLyBjYWxsYmFja3MgZm9yIHRoZSBldmVudC4gSWYgYG5hbWVgIGlzIG51bGwsIHJlbW92ZXMgYWxsIGJvdW5kXG4gICAgLy8gY2FsbGJhY2tzIGZvciBhbGwgZXZlbnRzLlxuICAgIG9mZjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICAgIHZhciByZXRhaW4sIGV2LCBldmVudHMsIG5hbWVzLCBpLCBsLCBqLCBrO1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIWV2ZW50c0FwaSh0aGlzLCAnb2ZmJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkpIHJldHVybiB0aGlzO1xuICAgICAgaWYgKCFuYW1lICYmICFjYWxsYmFjayAmJiAhY29udGV4dCkge1xuICAgICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG5cbiAgICAgIG5hbWVzID0gbmFtZSA/IFtuYW1lXSA6IF8ua2V5cyh0aGlzLl9ldmVudHMpO1xuICAgICAgZm9yIChpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBuYW1lID0gbmFtZXNbaV07XG4gICAgICAgIGlmIChldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV0pIHtcbiAgICAgICAgICB0aGlzLl9ldmVudHNbbmFtZV0gPSByZXRhaW4gPSBbXTtcbiAgICAgICAgICBpZiAoY2FsbGJhY2sgfHwgY29udGV4dCkge1xuICAgICAgICAgICAgZm9yIChqID0gMCwgayA9IGV2ZW50cy5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICAgICAgZXYgPSBldmVudHNbal07XG4gICAgICAgICAgICAgIGlmICgoY2FsbGJhY2sgJiYgY2FsbGJhY2sgIT09IGV2LmNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBldi5jYWxsYmFjay5fY2FsbGJhY2spIHx8XG4gICAgICAgICAgICAgICAgICAoY29udGV4dCAmJiBjb250ZXh0ICE9PSBldi5jb250ZXh0KSkge1xuICAgICAgICAgICAgICAgIHJldGFpbi5wdXNoKGV2KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXJldGFpbi5sZW5ndGgpIGRlbGV0ZSB0aGlzLl9ldmVudHNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8vIFRyaWdnZXIgb25lIG9yIG1hbnkgZXZlbnRzLCBmaXJpbmcgYWxsIGJvdW5kIGNhbGxiYWNrcy4gQ2FsbGJhY2tzIGFyZVxuICAgIC8vIHBhc3NlZCB0aGUgc2FtZSBhcmd1bWVudHMgYXMgYHRyaWdnZXJgIGlzLCBhcGFydCBmcm9tIHRoZSBldmVudCBuYW1lXG4gICAgLy8gKHVubGVzcyB5b3UncmUgbGlzdGVuaW5nIG9uIGBcImFsbFwiYCwgd2hpY2ggd2lsbCBjYXVzZSB5b3VyIGNhbGxiYWNrIHRvXG4gICAgLy8gcmVjZWl2ZSB0aGUgdHJ1ZSBuYW1lIG9mIHRoZSBldmVudCBhcyB0aGUgZmlyc3QgYXJndW1lbnQpLlxuICAgIHRyaWdnZXI6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzKSByZXR1cm4gdGhpcztcbiAgICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ3RyaWdnZXInLCBuYW1lLCBhcmdzKSkgcmV0dXJuIHRoaXM7XG4gICAgICB2YXIgZXZlbnRzID0gdGhpcy5fZXZlbnRzW25hbWVdO1xuICAgICAgdmFyIGFsbEV2ZW50cyA9IHRoaXMuX2V2ZW50cy5hbGw7XG4gICAgICBpZiAoZXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGV2ZW50cywgYXJncyk7XG4gICAgICBpZiAoYWxsRXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGFsbEV2ZW50cywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBUZWxsIHRoaXMgb2JqZWN0IHRvIHN0b3AgbGlzdGVuaW5nIHRvIGVpdGhlciBzcGVjaWZpYyBldmVudHMgLi4uIG9yXG4gICAgLy8gdG8gZXZlcnkgb2JqZWN0IGl0J3MgY3VycmVudGx5IGxpc3RlbmluZyB0by5cbiAgICBzdG9wTGlzdGVuaW5nOiBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgICAgaWYgKCFsaXN0ZW5lcnMpIHJldHVybiB0aGlzO1xuICAgICAgdmFyIGRlbGV0ZUxpc3RlbmVyID0gIW5hbWUgJiYgIWNhbGxiYWNrO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgICAgaWYgKG9iaikgKGxpc3RlbmVycyA9IHt9KVtvYmouX2xpc3RlbmVySWRdID0gb2JqO1xuICAgICAgZm9yICh2YXIgaWQgaW4gbGlzdGVuZXJzKSB7XG4gICAgICAgIGxpc3RlbmVyc1tpZF0ub2ZmKG5hbWUsIGNhbGxiYWNrLCB0aGlzKTtcbiAgICAgICAgaWYgKGRlbGV0ZUxpc3RlbmVyKSBkZWxldGUgdGhpcy5fbGlzdGVuZXJzW2lkXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICB9O1xuXG4gIC8vIFJlZ3VsYXIgZXhwcmVzc2lvbiB1c2VkIHRvIHNwbGl0IGV2ZW50IHN0cmluZ3MuXG4gIHZhciBldmVudFNwbGl0dGVyID0gL1xccysvO1xuXG4gIC8vIEltcGxlbWVudCBmYW5jeSBmZWF0dXJlcyBvZiB0aGUgRXZlbnRzIEFQSSBzdWNoIGFzIG11bHRpcGxlIGV2ZW50XG4gIC8vIG5hbWVzIGBcImNoYW5nZSBibHVyXCJgIGFuZCBqUXVlcnktc3R5bGUgZXZlbnQgbWFwcyBge2NoYW5nZTogYWN0aW9ufWBcbiAgLy8gaW4gdGVybXMgb2YgdGhlIGV4aXN0aW5nIEFQSS5cbiAgdmFyIGV2ZW50c0FwaSA9IGZ1bmN0aW9uKG9iaiwgYWN0aW9uLCBuYW1lLCByZXN0KSB7XG4gICAgaWYgKCFuYW1lKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEhhbmRsZSBldmVudCBtYXBzLlxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBuYW1lKSB7XG4gICAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW2tleSwgbmFtZVtrZXldXS5jb25jYXQocmVzdCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBzcGFjZSBzZXBhcmF0ZWQgZXZlbnQgbmFtZXMuXG4gICAgaWYgKGV2ZW50U3BsaXR0ZXIudGVzdChuYW1lKSkge1xuICAgICAgdmFyIG5hbWVzID0gbmFtZS5zcGxpdChldmVudFNwbGl0dGVyKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW25hbWVzW2ldXS5jb25jYXQocmVzdCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8vIEEgZGlmZmljdWx0LXRvLWJlbGlldmUsIGJ1dCBvcHRpbWl6ZWQgaW50ZXJuYWwgZGlzcGF0Y2ggZnVuY3Rpb24gZm9yXG4gIC8vIHRyaWdnZXJpbmcgZXZlbnRzLiBUcmllcyB0byBrZWVwIHRoZSB1c3VhbCBjYXNlcyBzcGVlZHkgKG1vc3QgaW50ZXJuYWxcbiAgLy8gQmFja2JvbmUgZXZlbnRzIGhhdmUgMyBhcmd1bWVudHMpLlxuICB2YXIgdHJpZ2dlckV2ZW50cyA9IGZ1bmN0aW9uKGV2ZW50cywgYXJncykge1xuICAgIHZhciBldiwgaSA9IC0xLCBsID0gZXZlbnRzLmxlbmd0aCwgYTEgPSBhcmdzWzBdLCBhMiA9IGFyZ3NbMV0sIGEzID0gYXJnc1syXTtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDA6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4KTsgcmV0dXJuO1xuICAgICAgY2FzZSAxOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEpOyByZXR1cm47XG4gICAgICBjYXNlIDI6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIpOyByZXR1cm47XG4gICAgICBjYXNlIDM6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIsIGEzKTsgcmV0dXJuO1xuICAgICAgZGVmYXVsdDogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suYXBwbHkoZXYuY3R4LCBhcmdzKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGxpc3Rlbk1ldGhvZHMgPSB7bGlzdGVuVG86ICdvbicsIGxpc3RlblRvT25jZTogJ29uY2UnfTtcblxuICAvLyBJbnZlcnNpb24tb2YtY29udHJvbCB2ZXJzaW9ucyBvZiBgb25gIGFuZCBgb25jZWAuIFRlbGwgKnRoaXMqIG9iamVjdCB0b1xuICAvLyBsaXN0ZW4gdG8gYW4gZXZlbnQgaW4gYW5vdGhlciBvYmplY3QgLi4uIGtlZXBpbmcgdHJhY2sgb2Ygd2hhdCBpdCdzXG4gIC8vIGxpc3RlbmluZyB0by5cbiAgXy5lYWNoKGxpc3Rlbk1ldGhvZHMsIGZ1bmN0aW9uKGltcGxlbWVudGF0aW9uLCBtZXRob2QpIHtcbiAgICBFdmVudHNbbWV0aG9kXSA9IGZ1bmN0aW9uKG9iaiwgbmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMgfHwgKHRoaXMuX2xpc3RlbmVycyA9IHt9KTtcbiAgICAgIHZhciBpZCA9IG9iai5fbGlzdGVuZXJJZCB8fCAob2JqLl9saXN0ZW5lcklkID0gXy51bmlxdWVJZCgnbCcpKTtcbiAgICAgIGxpc3RlbmVyc1tpZF0gPSBvYmo7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSBjYWxsYmFjayA9IHRoaXM7XG4gICAgICBvYmpbaW1wbGVtZW50YXRpb25dKG5hbWUsIGNhbGxiYWNrLCB0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEFsaWFzZXMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICBFdmVudHMuYmluZCAgID0gRXZlbnRzLm9uO1xuICBFdmVudHMudW5iaW5kID0gRXZlbnRzLm9mZjtcblxuICAvLyBNaXhpbiB1dGlsaXR5XG4gIEV2ZW50cy5taXhpbiA9IGZ1bmN0aW9uKHByb3RvKSB7XG4gICAgdmFyIGV4cG9ydHMgPSBbJ29uJywgJ29uY2UnLCAnb2ZmJywgJ3RyaWdnZXInLCAnc3RvcExpc3RlbmluZycsICdsaXN0ZW5UbycsXG4gICAgICAgICAgICAgICAgICAgJ2xpc3RlblRvT25jZScsICdiaW5kJywgJ3VuYmluZCddO1xuICAgIF8uZWFjaChleHBvcnRzLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBwcm90b1tuYW1lXSA9IHRoaXNbbmFtZV07XG4gICAgfSwgdGhpcyk7XG4gICAgcmV0dXJuIHByb3RvO1xuICB9O1xuXG4gIC8vIEV4cG9ydCBFdmVudHMgYXMgQmFja2JvbmVFdmVudHMgZGVwZW5kaW5nIG9uIGN1cnJlbnQgY29udGV4dFxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBFdmVudHM7XG4gICAgfVxuICAgIGV4cG9ydHMuQmFja2JvbmVFdmVudHMgPSBFdmVudHM7XG4gIH1lbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgICYmIHR5cGVvZiBkZWZpbmUuYW1kID09IFwib2JqZWN0XCIpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRXZlbnRzO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuQmFja2JvbmVFdmVudHMgPSBFdmVudHM7XG4gIH1cbn0pKHRoaXMpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lJyk7XG4iLCIvLyBkMy50aXBcbi8vIENvcHlyaWdodCAoYykgMjAxMyBKdXN0aW4gUGFsbWVyXG4vL1xuLy8gVG9vbHRpcHMgZm9yIGQzLmpzIFNWRyB2aXN1YWxpemF0aW9uc1xuXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZSB3aXRoIGQzIGFzIGEgZGVwZW5kZW5jeS5cbiAgICBkZWZpbmUoWydkMyddLCBmYWN0b3J5KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgLy8gQ29tbW9uSlNcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGQzKSB7XG4gICAgICBkMy50aXAgPSBmYWN0b3J5KGQzKVxuICAgICAgcmV0dXJuIGQzLnRpcFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbC5cbiAgICByb290LmQzLnRpcCA9IGZhY3Rvcnkocm9vdC5kMylcbiAgfVxufSh0aGlzLCBmdW5jdGlvbiAoZDMpIHtcblxuICAvLyBQdWJsaWMgLSBjb250cnVjdHMgYSBuZXcgdG9vbHRpcFxuICAvL1xuICAvLyBSZXR1cm5zIGEgdGlwXG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGlyZWN0aW9uID0gZDNfdGlwX2RpcmVjdGlvbixcbiAgICAgICAgb2Zmc2V0ICAgID0gZDNfdGlwX29mZnNldCxcbiAgICAgICAgaHRtbCAgICAgID0gZDNfdGlwX2h0bWwsXG4gICAgICAgIG5vZGUgICAgICA9IGluaXROb2RlKCksXG4gICAgICAgIHN2ZyAgICAgICA9IG51bGwsXG4gICAgICAgIHBvaW50ICAgICA9IG51bGwsXG4gICAgICAgIHRhcmdldCAgICA9IG51bGxcblxuICAgIGZ1bmN0aW9uIHRpcCh2aXMpIHtcbiAgICAgIHN2ZyA9IGdldFNWR05vZGUodmlzKVxuICAgICAgcG9pbnQgPSBzdmcuY3JlYXRlU1ZHUG9pbnQoKVxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKVxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIHNob3cgdGhlIHRvb2x0aXAgb24gdGhlIHNjcmVlblxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5zaG93ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgIGlmKGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFNWR0VsZW1lbnQpIHRhcmdldCA9IGFyZ3MucG9wKClcblxuICAgICAgdmFyIGNvbnRlbnQgPSBodG1sLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIHBvZmZzZXQgPSBvZmZzZXQuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgZGlyICAgICA9IGRpcmVjdGlvbi5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBub2RlbCAgID0gZDMuc2VsZWN0KG5vZGUpLFxuICAgICAgICAgIGkgICAgICAgPSBkaXJlY3Rpb25zLmxlbmd0aCxcbiAgICAgICAgICBjb29yZHMsXG4gICAgICAgICAgc2Nyb2xsVG9wICA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AsXG4gICAgICAgICAgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxuXG4gICAgICBub2RlbC5odG1sKGNvbnRlbnQpXG4gICAgICAgIC5zdHlsZSh7IG9wYWNpdHk6IDEsICdwb2ludGVyLWV2ZW50cyc6ICdhbGwnIH0pXG5cbiAgICAgIHdoaWxlKGktLSkgbm9kZWwuY2xhc3NlZChkaXJlY3Rpb25zW2ldLCBmYWxzZSlcbiAgICAgIGNvb3JkcyA9IGRpcmVjdGlvbl9jYWxsYmFja3MuZ2V0KGRpcikuYXBwbHkodGhpcylcbiAgICAgIG5vZGVsLmNsYXNzZWQoZGlyLCB0cnVlKS5zdHlsZSh7XG4gICAgICAgIHRvcDogKGNvb3Jkcy50b3AgKyAgcG9mZnNldFswXSkgKyBzY3JvbGxUb3AgKyAncHgnLFxuICAgICAgICBsZWZ0OiAoY29vcmRzLmxlZnQgKyBwb2Zmc2V0WzFdKSArIHNjcm9sbExlZnQgKyAncHgnXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gaGlkZSB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5oaWRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm9kZWwgPSBkMy5zZWxlY3Qobm9kZSlcbiAgICAgIG5vZGVsLnN0eWxlKHsgb3BhY2l0eTogMCwgJ3BvaW50ZXItZXZlbnRzJzogJ25vbmUnIH0pXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBhdHRyIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgYXR0cmlidXRlIHZhbHVlXG4gICAgdGlwLmF0dHIgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBkMy5zZWxlY3Qobm9kZSkuYXR0cihuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLmF0dHIuYXBwbHkoZDMuc2VsZWN0KG5vZGUpLCBhcmdzKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBzdHlsZSBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhIHN0eWxlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3Igc3R5bGUgcHJvcGVydHkgdmFsdWVcbiAgICB0aXAuc3R5bGUgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBkMy5zZWxlY3Qobm9kZSkuc3R5bGUobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5zdHlsZS5hcHBseShkMy5zZWxlY3Qobm9kZSksIGFyZ3MpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldCBvciBnZXQgdGhlIGRpcmVjdGlvbiBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIE9uZSBvZiBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIG9yIHcod2VzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gICAgIHN3KHNvdXRod2VzdCksIG5lKG5vcnRoZWFzdCkgb3Igc2Uoc291dGhlYXN0KVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgZGlyZWN0aW9uXG4gICAgdGlwLmRpcmVjdGlvbiA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpcmVjdGlvblxuICAgICAgZGlyZWN0aW9uID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0cyBvciBnZXRzIHRoZSBvZmZzZXQgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIEFycmF5IG9mIFt4LCB5XSBvZmZzZXRcbiAgICAvL1xuICAgIC8vIFJldHVybnMgb2Zmc2V0IG9yXG4gICAgdGlwLm9mZnNldCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9mZnNldFxuICAgICAgb2Zmc2V0ID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogc2V0cyBvciBnZXRzIHRoZSBodG1sIHZhbHVlIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gU3RyaW5nIHZhbHVlIG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgaHRtbCB2YWx1ZSBvciB0aXBcbiAgICB0aXAuaHRtbCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGh0bWxcbiAgICAgIGh0bWwgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZDNfdGlwX2RpcmVjdGlvbigpIHsgcmV0dXJuICduJyB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX29mZnNldCgpIHsgcmV0dXJuIFswLCAwXSB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX2h0bWwoKSB7IHJldHVybiAnICcgfVxuXG4gICAgdmFyIGRpcmVjdGlvbl9jYWxsYmFja3MgPSBkMy5tYXAoe1xuICAgICAgbjogIGRpcmVjdGlvbl9uLFxuICAgICAgczogIGRpcmVjdGlvbl9zLFxuICAgICAgZTogIGRpcmVjdGlvbl9lLFxuICAgICAgdzogIGRpcmVjdGlvbl93LFxuICAgICAgbnc6IGRpcmVjdGlvbl9udyxcbiAgICAgIG5lOiBkaXJlY3Rpb25fbmUsXG4gICAgICBzdzogZGlyZWN0aW9uX3N3LFxuICAgICAgc2U6IGRpcmVjdGlvbl9zZVxuICAgIH0pLFxuXG4gICAgZGlyZWN0aW9ucyA9IGRpcmVjdGlvbl9jYWxsYmFja3Mua2V5cygpXG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbigpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm4ueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm4ueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3MoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zLnksXG4gICAgICAgIGxlZnQ6IGJib3gucy54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX253KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX25lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zdy55LFxuICAgICAgICBsZWZ0OiBiYm94LnN3LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3NlKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc2UueSxcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0Tm9kZSgpIHtcbiAgICAgIHZhciBub2RlID0gZDMuc2VsZWN0KGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxuICAgICAgbm9kZS5zdHlsZSh7XG4gICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgICB0b3A6IDAsXG4gICAgICAgIG9wYWNpdHk6IDAsXG4gICAgICAgICdwb2ludGVyLWV2ZW50cyc6ICdub25lJyxcbiAgICAgICAgJ2JveC1zaXppbmcnOiAnYm9yZGVyLWJveCdcbiAgICAgIH0pXG5cbiAgICAgIHJldHVybiBub2RlLm5vZGUoKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNWR05vZGUoZWwpIHtcbiAgICAgIGVsID0gZWwubm9kZSgpXG4gICAgICBpZihlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzdmcnKVxuICAgICAgICByZXR1cm4gZWxcblxuICAgICAgcmV0dXJuIGVsLm93bmVyU1ZHRWxlbWVudFxuICAgIH1cblxuICAgIC8vIFByaXZhdGUgLSBnZXRzIHRoZSBzY3JlZW4gY29vcmRpbmF0ZXMgb2YgYSBzaGFwZVxuICAgIC8vXG4gICAgLy8gR2l2ZW4gYSBzaGFwZSBvbiB0aGUgc2NyZWVuLCB3aWxsIHJldHVybiBhbiBTVkdQb2ludCBmb3IgdGhlIGRpcmVjdGlvbnNcbiAgICAvLyBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIHcod2VzdCksIG5lKG5vcnRoZWFzdCksIHNlKHNvdXRoZWFzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gc3coc291dGh3ZXN0KS5cbiAgICAvL1xuICAgIC8vICAgICstKy0rXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArICAgK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKy0rLStcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYW4gT2JqZWN0IHtuLCBzLCBlLCB3LCBudywgc3csIG5lLCBzZX1cbiAgICBmdW5jdGlvbiBnZXRTY3JlZW5CQm94KCkge1xuICAgICAgdmFyIHRhcmdldGVsICAgPSB0YXJnZXQgfHwgZDMuZXZlbnQudGFyZ2V0O1xuXG4gICAgICB3aGlsZSAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiB0YXJnZXRlbC5nZXRTY3JlZW5DVE0gJiYgJ3VuZGVmaW5lZCcgPT09IHRhcmdldGVsLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0YXJnZXRlbCA9IHRhcmdldGVsLnBhcmVudE5vZGU7XG4gICAgICB9XG5cbiAgICAgIHZhciBiYm94ICAgICAgID0ge30sXG4gICAgICAgICAgbWF0cml4ICAgICA9IHRhcmdldGVsLmdldFNjcmVlbkNUTSgpLFxuICAgICAgICAgIHRiYm94ICAgICAgPSB0YXJnZXRlbC5nZXRCQm94KCksXG4gICAgICAgICAgd2lkdGggICAgICA9IHRiYm94LndpZHRoLFxuICAgICAgICAgIGhlaWdodCAgICAgPSB0YmJveC5oZWlnaHQsXG4gICAgICAgICAgeCAgICAgICAgICA9IHRiYm94LngsXG4gICAgICAgICAgeSAgICAgICAgICA9IHRiYm94LnlcblxuICAgICAgcG9pbnQueCA9IHhcbiAgICAgIHBvaW50LnkgPSB5XG4gICAgICBiYm94Lm53ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3gubmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3guc2UgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aFxuICAgICAgYmJveC5zdyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gudyAgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGggLyAyXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gubiA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcblxuICAgICAgcmV0dXJuIGJib3hcbiAgICB9XG5cbiAgICByZXR1cm4gdGlwXG4gIH07XG5cbn0pKTtcbiIsIi8qKlxuICpcbiAqIE11dGF0aW9ucyBOZWVkbGUgUGxvdCAobXV0cy1uZWVkbGUtcGxvdClcbiAqXG4gKiBDcmVhdGVzIGEgbmVlZGxlIHBsb3QgKGEuay5hIHN0ZW0gcGxvdCwgbG9sbGlwb3AtcGxvdCBhbmQgc29vbiBhbHNvIGJhbGxvb24gcGxvdCA7LSlcbiAqIFRoaXMgY2xhc3MgdXNlcyB0aGUgbnBtLXJlcXVpcmUgbW9kdWxlIHRvIGxvYWQgZGVwZW5kZW5jaWVzIGQzLCBkMy10aXBcbiAqXG4gKiBAYXV0aG9yIE1pY2hhZWwgUCBTY2hyb2VkZXJcbiAqIEBjbGFzc1xuICovXG5cbmZ1bmN0aW9uIE11dHNOZWVkbGVQbG90IChjb25maWcpIHtcblxuICAgIC8vIElOSVRJQUxJWkFUSU9OXG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7ICAgICAgICAvLyBzZWxmID0gTXV0c05lZWRsZVBsb3RcblxuICAgIC8vIFgtY29vcmRpbmF0ZXNcbiAgICB0aGlzLm1heENvb3JkID0gY29uZmlnLm1heENvb3JkIHx8IC0xOyAgICAgICAgICAgICAvLyBUaGUgbWF4aW11bSBjb29yZCAoeC1heGlzKVxuICAgIGlmICh0aGlzLm1heENvb3JkIDwgMCkgeyB0aHJvdyBuZXcgRXJyb3IoXCInbWF4Q29vcmQnIG11c3QgYmUgZGVmaW5lZCBpbml0aWF0aW9uIGNvbmZpZyFcIik7IH1cbiAgICB0aGlzLm1pbkNvb3JkID0gY29uZmlnLm1pbkNvb3JkIHx8IDE7ICAgICAgICAgICAgICAgLy8gVGhlIG1pbmltdW0gY29vcmQgKHgtYXhpcylcblxuICAgIC8vIGRhdGFcbiAgICB2YXIgbXV0YXRpb25EYXRhID0gY29uZmlnLm11dGF0aW9uRGF0YSB8fCAtMTsgICAgICAgICAgLy8gLmpzb24gZmlsZSBvciBkaWN0XG4gICAgaWYgKHRoaXMubWF4Q29vcmQgPCAwKSB7IHRocm93IG5ldyBFcnJvcihcIidtdXRhdGlvbkRhdGEnIG11c3QgYmUgZGVmaW5lZCBpbml0aWF0aW9uIGNvbmZpZyFcIik7IH1cbiAgICB2YXIgcmVnaW9uRGF0YSA9IGNvbmZpZy5yZWdpb25EYXRhIHx8IC0xOyAgICAgICAgICAgICAgLy8gLmpzb24gZmlsZSBvciBkaWN0XG4gICAgaWYgKHRoaXMubWF4Q29vcmQgPCAwKSB7IHRocm93IG5ldyBFcnJvcihcIidyZWdpb25EYXRhJyBtdXN0IGJlIGRlZmluZWQgaW5pdGlhdGlvbiBjb25maWchXCIpOyB9XG4gICAgdGhpcy50b3RhbENhdGVnQ291bnRzID0ge307XG4gICAgdGhpcy5jYXRlZ0NvdW50cyA9IHt9O1xuICAgIHRoaXMuc2VsZWN0ZWROZWVkbGVzID0gW107XG5cbiAgICAvLyBQbG90IGRpbWVuc2lvbnMgJiB0YXJnZXRcbiAgICB2YXIgdGFyZ2V0RWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy50YXJnZXRFbGVtZW50KSB8fCBjb25maWcudGFyZ2V0RWxlbWVudCB8fCBkb2N1bWVudC5ib2R5ICAgLy8gV2hlcmUgdG8gYXBwZW5kIHRoZSBwbG90IChzdmcpXG5cbiAgICB2YXIgd2lkdGggPSB0aGlzLndpZHRoID0gY29uZmlnLndpZHRoIHx8IHRhcmdldEVsZW1lbnQub2Zmc2V0V2lkdGggfHwgMTAwMDtcbiAgICB2YXIgaGVpZ2h0ID0gdGhpcy5oZWlnaHQgPSBjb25maWcuaGVpZ2h0IHx8IHRhcmdldEVsZW1lbnQub2Zmc2V0SGVpZ2h0IHx8IDUwMDtcblxuICAgIC8vIENvbG9yIHNjYWxlICYgbWFwXG4gICAgdGhpcy5jb2xvck1hcCA9IGNvbmZpZy5jb2xvck1hcCB8fCB7fTsgICAgICAgICAgICAgIC8vIGRpY3RcbiAgICB2YXIgY29sb3JzID0gT2JqZWN0LmtleXModGhpcy5jb2xvck1hcCkubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY29sb3JNYXBba2V5XTtcbiAgICB9KTtcbiAgICB0aGlzLmNvbG9yU2NhbGUgPSBkMy5zY2FsZS5jYXRlZ29yeTIwKClcbiAgICAgICAgLmRvbWFpbihPYmplY3Qua2V5cyh0aGlzLmNvbG9yTWFwKSlcbiAgICAgICAgLnJhbmdlKGNvbG9ycy5jb25jYXQoZDMuc2NhbGUuY2F0ZWdvcnkyMCgpLnJhbmdlKCkpKTtcbiAgICB0aGlzLmxlZ2VuZHMgPSBjb25maWcubGVnZW5kcyB8fCB7XG4gICAgICAgIFwieVwiOiBcIlZhbHVlXCIsXG4gICAgICAgIFwieFwiOiBcIkNvb3JkaW5hdGVcIlxuICAgIH07XG5cbiAgICB0aGlzLnN2Z0NsYXNzZXMgPSBcIm11dG5lZWRsZXNcIjtcbiAgICB0aGlzLmJ1ZmZlciA9IDA7XG5cbiAgICB2YXIgbWF4Q29vcmQgPSB0aGlzLm1heENvb3JkO1xuXG4gICAgdmFyIGJ1ZmZlciA9IDA7XG4gICAgaWYgKHdpZHRoID49IGhlaWdodCkge1xuICAgICAgYnVmZmVyID0gaGVpZ2h0IC8gODtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyID0gd2lkdGggLyA4O1xuICAgIH1cblxuICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuXG4gICAgLy8gSUlNUE9SVCBBTkQgQ09ORklHVVJFIFRJUFNcbiAgICB2YXIgZDN0aXAgPSByZXF1aXJlKCdkMy10aXAnKTtcbiAgICBkM3RpcChkMyk7XG5cbiAgICB2YXIgbmVlZGxlVGlwID0gY29uZmlnLm5lZWRsZVRpcCB8fFxuICAgICAgICBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI8c3Bhbj5cIiArIGQudmFsdWUgKyBcIiBcIiArIGQuY2F0ZWdvcnkgKyAgXCIgYXQgY29vcmQuIFwiICsgZC5jb29yZFN0cmluZyArIFwiPC9zcGFuPlwiO1xuICAgICAgICB9XG5cbiAgICB2YXIgc2VsZWN0aW9uVGlwID0gY29uZmlnLnNlbGVjdGlvblRpcCB8fFxuICAgICAgICBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI8c3Bhbj4gU2VsZWN0ZWQgY29vcmRpbmF0ZXM8YnIvPlwiICsgTWF0aC5yb3VuZChkLmxlZnQpICsgXCIgLSBcIiArIE1hdGgucm91bmQoZC5yaWdodCkgKyBcIjwvc3Bhbj5cIjtcbiAgICAgICAgfVxuXG4gICAgdmFyIHJlZ2lvblRpcCA9IGNvbmZpZy5yZWdpb25UaXAgfHxcbiAgICAgICAgZnVuY3Rpb24oZCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiPHNwYW4+XCIgKyBkLm5hbWUgKyBcIjwvc3Bhbj5cIjtcbiAgICAgICAgfVxuXG5cbiAgICB0aGlzLnRpcCA9IGQzLnRpcCgpXG4gICAgICAuYXR0cignY2xhc3MnLCAnbXV0cy1uZWVkbGUtcGxvdCBkMy10aXAgZDMtdGlwLW5lZWRsZScpXG4gICAgICAub2Zmc2V0KFstMTAsIDBdKVxuICAgICAgLmh0bWwobmVlZGxlVGlwKTtcblxuICAgIHRoaXMuc2VsZWN0aW9uVGlwID0gZDMudGlwKClcbiAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ211dHMtbmVlZGxlLXBsb3QgZDMtdGlwIGQzLXRpcC1zZWxlY3Rpb24nKVxuICAgICAgICAub2Zmc2V0KFstNTAsIDBdKVxuICAgICAgICAuaHRtbChzZWxlY3Rpb25UaXApXG4gICAgICAgIC5kaXJlY3Rpb24oJ24nKTtcblxuICAgIHRoaXMucmVnaW9uVGlwID0gZDMudGlwKClcbiAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ211dHMtbmVlZGxlLXBsb3QgZDMtdGlwIGQzLXRpcC1yZWdpb24nKVxuICAgICAgICAub2Zmc2V0KFstMTAsIDBdKVxuICAgICAgICAuaHRtbChyZWdpb25UaXApXG4gICAgICAgIC5kaXJlY3Rpb24oJ24nKTtcblxuICAgIC8vIElOSVQgU1ZHXG4gICAgdmFyIHN2ZztcbiAgICB2YXIgdG9wbm9kZTtcbiAgICBpZiAoY29uZmlnLnJlc3BvbnNpdmUgPT0gJ3Jlc2l6ZScpIHtcbiAgICAgICAgdG9wbm9kZSAgPSBkMy5zZWxlY3QodGFyZ2V0RWxlbWVudCkuYXBwZW5kKFwic3ZnXCIpXG4gICAgICAgICAgICAuYXR0cihcIndpZHRoXCIsICcxMDAlJylcbiAgICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsICcxMDAlJylcbiAgICAgICAgICAgIC5hdHRyKCd2aWV3Qm94JywnMCAwICcrTWF0aC5taW4od2lkdGgpKycgJytNYXRoLm1pbihoZWlnaHQpKVxuICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2JydXNoJyk7XG4gICAgICAgIHN2ZyA9IHRvcG5vZGVcbiAgICAgICAgICAgIC5hcHBlbmQoXCJnXCIpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIHRoaXMuc3ZnQ2xhc3NlcylcbiAgICAgICAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsMClcIik7XG4gICAgfSBlbHNlICB7XG5cbiAgICAgICAgc3ZnID0gZDMuc2VsZWN0KHRhcmdldEVsZW1lbnQpLmFwcGVuZChcInN2Z1wiKVxuICAgICAgICAgICAgLmF0dHIoXCJ3aWR0aFwiLCB3aWR0aClcbiAgICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIGhlaWdodClcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgdGhpcy5zdmdDbGFzc2VzICsgXCIgYnJ1c2hcIik7XG4gICAgICAgIHRvcG5vZGUgPSBzdmc7XG4gICAgfVxuXG5cbiAgICBzdmcuY2FsbCh0aGlzLnRpcCk7XG4gICAgc3ZnLmNhbGwodGhpcy5zZWxlY3Rpb25UaXApO1xuICAgIHN2Zy5jYWxsKHRoaXMucmVnaW9uVGlwKTtcblxuICAgIC8vIERFRklORSBTQ0FMRVNcblxuICAgIHRoaXMuc2VnbWVudHMgPSBjb25maWcuc2VnbWVudHNcblxuICAgIHZhciB4XG4gICAgaWYgKGNvbmZpZy5zZWdtZW50cykge1xuICAgICAgICB4ID0gc2VnbWVudGVkRG9tYWluKGNvbmZpZy5zZWdtZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLjEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHggPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAgICAgLmRvbWFpbihbdGhpcy5taW5Db29yZCwgdGhpcy5tYXhDb29yZF0pXG4gICAgICAgICAgICAucmFuZ2UoW2J1ZmZlciAqIDEuNSAsIHdpZHRoIC0gYnVmZmVyXSlcbiAgICAgICAgICAgIC5uaWNlKCk7XG4gICAgfVxuXG5cbiAgICB0aGlzLnggPSB4O1xuXG4gICAgdmFyIHkgPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgLmRvbWFpbihbMSwyMF0pXG4gICAgICAucmFuZ2UoW2hlaWdodCAtIGJ1ZmZlciAqIDEuNSwgYnVmZmVyXSlcbiAgICAgIC5uaWNlKCk7XG4gICAgdGhpcy55ID0geTtcblxuICAgIC8vIENPTkZJR1VSRSBCUlVTSFxuICAgIHNlbGYuc2VsZWN0b3IgPSBkMy5zdmcuYnJ1c2goKVxuICAgICAgICAueCh4KVxuICAgICAgICAub24oXCJicnVzaFwiLCBicnVzaG1vdmUpXG4gICAgICAgIC5vbihcImJydXNoZW5kXCIsIGJydXNoZW5kKTtcbiAgICB2YXIgc2VsZWN0b3IgPSBzZWxmLnNlbGVjdG9yO1xuXG4gICAgdmFyIHNlbGVjdGlvblJlY3QgPSB0b3Bub2RlXG4gICAgICAgIC5jYWxsKHNlbGVjdG9yKVxuICAgICAgICAuc2VsZWN0QWxsKCcuZXh0ZW50JylcbiAgICAgICAgLmF0dHIoJ2hlaWdodCcsIDUwKVxuICAgICAgICAuYXR0cigneScsIGhlaWdodC01MClcbiAgICAgICAgLmF0dHIoJ29wYWNpdHknLCAwLjIpO1xuXG4gICAgc2VsZWN0aW9uUmVjdC5vbihcIm1vdXNlZW50ZXJcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxlY3Rpb24gPSBzZWxlY3Rvci5leHRlbnQoKTtcbiAgICAgICAgc2VsZi5zZWxlY3Rpb25UaXAuc2hvdyh7bGVmdDogc2VsZWN0aW9uWzBdLCByaWdodDogc2VsZWN0aW9uWzFdfSwgc2VsZWN0aW9uUmVjdC5ub2RlKCkpO1xuICAgIH0pXG4gICAgICAgIC5vbihcIm1vdXNlb3V0XCIsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAvL2QzLnNlbGVjdChcIi5kMy10aXAtc2VsZWN0aW9uXCIpXG4gICAgICAgICAgICBzZWxmLnNlbGVjdGlvblRpcFxuICAgICAgICAgICAgICAgIC8vLnRyYW5zaXRpb24oKVxuICAgICAgICAgICAgICAgIC8vLmRlbGF5KDMwMDApXG4gICAgICAgICAgICAgICAgLy8uZHVyYXRpb24oMTAwMClcbiAgICAgICAgICAgICAgICAuc3R5bGUoXCJvcGFjaXR5XCIsMClcbiAgICAgICAgICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKTtcbiAgICAgICAgfSk7XG5cbiAgICBmdW5jdGlvbiBzZWxlY3Rpb25EZXRhaWxzKCkge1xuICAgICAgICB2YXIgZXh0ZW50ID0gc2VsZWN0b3IuZXh0ZW50KCk7XG4gICAgICAgIHZhciBuZWVkbGVIZWFkcyA9IHN2Zy5zZWxlY3RBbGwoXCIubmVlZGxlLWhlYWRcIik7XG4gICAgICAgIHZhciBzZWxlY3RlZE5lZWRsZXMgPSBbXTtcbiAgICAgICAgdmFyIGNhdGVnQ291bnRzID0ge307XG4gICAgICAgIGZvciAoa2V5IGluIE9iamVjdC5rZXlzKHNlbGYudG90YWxDYXRlZ0NvdW50cykpIHtcbiAgICAgICAgICAgIGNhdGVnQ291bnRzW2tleV0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgbmVlZGxlSGVhZHMuY2xhc3NlZChcInNlbGVjdGVkXCIsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgICAgIGlzX2JydXNoZWQgPSBleHRlbnRbMF0gPD0gZC5jb29yZCAmJiBkLmNvb3JkIDw9IGV4dGVudFsxXTtcbiAgICAgICAgICAgIGlmIChpc19icnVzaGVkKSB7XG4gICAgICAgICAgICAgICAgc2VsZWN0ZWROZWVkbGVzLnB1c2goZCk7XG4gICAgICAgICAgICAgICAgY2F0ZWdDb3VudHNbZC5jYXRlZ29yeV0gPSAoY2F0ZWdDb3VudHNbZC5jYXRlZ29yeV0gfHwgMCkgKyBkLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGlzX2JydXNoZWQ7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzZWxlY3RlZDogc2VsZWN0ZWROZWVkbGVzLFxuICAgICAgICAgICAgY2F0ZWdDb3VudHM6IGNhdGVnQ291bnRzLFxuICAgICAgICAgICAgY29vcmRzOiBleHRlbnQsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBicnVzaG1vdmUoKSB7XG4gICAgICAgIHNlbGYudHJpZ2dlcignbmVlZGxlU2VsZWN0aW9uQ2hhbmdlJyxcbiAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGlvbkRldGFpbHMoKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnJ1c2hlbmQoKSB7XG4gICAgICAgIC8vZ2V0X2J1dHRvbiA9IGQzLnNlbGVjdChcIi5jbGVhci1idXR0b25cIik7XG4gICAgICAgIHNlbGYudHJpZ2dlcignbmVlZGxlU2VsZWN0aW9uQ2hhbmdlRW5kJyxcbiAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGlvbkRldGFpbHMoKSk7XG4gICAgfVxuXG4gICAgLy8vIERSQVdcbiAgICB0aGlzLmRyYXdOZWVkbGVzKHN2ZywgbXV0YXRpb25EYXRhLCByZWdpb25EYXRhLCBjb25maWcubm9SZWdpb25MYWJlbHMpO1xuXG5cbiAgICBzZWxmLm9uKFwibmVlZGxlU2VsZWN0aW9uQ2hhbmdlXCIsIGZ1bmN0aW9uIChlZGF0YSkge1xuICAgICAgICBzZWxmLmNhdGVnQ291bnRzID0gZWRhdGEuY2F0ZWdDb3VudHM7XG4gICAgICAgIHNlbGYuc2VsZWN0ZWROZWVkbGVzID0gZWRhdGEuc2VsZWN0ZWQ7XG4gICAgICAgIHN2Zy5jYWxsKHNlbGYudmVydGljYWxMZWdlbmQpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5vbihcIm5lZWRsZVNlbGVjdGlvbkNoYW5nZUVuZFwiLCBmdW5jdGlvbiAoZWRhdGEpIHtcbiAgICAgICAgc2VsZi5jYXRlZ0NvdW50cyA9IGVkYXRhLmNhdGVnQ291bnRzO1xuICAgICAgICBzZWxmLnNlbGVjdGVkTmVlZGxlcyA9IGVkYXRhLnNlbGVjdGVkO1xuICAgICAgICBzdmcuY2FsbChzZWxmLnZlcnRpY2FsTGVnZW5kKTtcbiAgICB9KTtcblxuICAgIHNlbGYub24oXCJuZWVkbGVTZWxlY3Rpb25DaGFuZ2VcIiwgZnVuY3Rpb24oZWRhdGEpIHtcbiAgICAgICAgdmFyIHNlbGVjdGlvbiA9IGVkYXRhLmNvb3JkcztcbiAgICAgICAgaWYgKHNlbGVjdGlvblsxXSAtIHNlbGVjdGlvblswXSA+IDApIHtcbiAgICAgICAgICAgIHNlbGYuc2VsZWN0aW9uVGlwLnNob3coe2xlZnQ6IHNlbGVjdGlvblswXSwgcmlnaHQ6IHNlbGVjdGlvblsxXX0sIHNlbGVjdGlvblJlY3Qubm9kZSgpKTtcbiAgICAgICAgICAgIC8vZDMuc2VsZWN0KFwiLmQzLXRpcC1zZWxlY3Rpb25cIilcbiAgICAgICAgICAgIHNlbGYuc2VsZWN0aW9uVGlwXG4gICAgICAgICAgICAgICAgLy8udHJhbnNpdGlvbigpXG4gICAgICAgICAgICAgICAgLy8uZGVsYXkoMzAwMClcbiAgICAgICAgICAgICAgICAvLy5hZHVyYXRpb24oMTAwMClcbiAgICAgICAgICAgICAgICAuc3R5bGUoXCJvcGFjaXR5XCIsMClcbiAgICAgICAgICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc2VsZWN0aW9uVGlwLmhpZGUoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG59XG5cbi8vc2VnbWVudGVkRG9tYWluKFsgeyBtaW5Db29yZDogMTAwMCwgbWF4Q29vcmQ6IDEwMTAgfSBdLCAwLCAxMDAsIDEwMDApXG4vL3NlZ21lbnRlZERvbWFpbihbIHsgbWluQ29vcmQ6IDEwMDAsIG1heENvb3JkOiAxMDEwIH0sIHsgbWluQ29vcmQ6IDIwMDAsIG1heENvb3JkOiAyMDUwIH0sIHsgbWluQ29vcmQ6IDYwMDAwLCBtYXhDb29yZDogNjAwMzAgfSBdLCAwLCAxMDAsIDEwMDApXG4vL3NlZ21lbnRlZERvbWFpbihbIHsgbWluQ29vcmQ6IDEwMDAsIG1heENvb3JkOiAxMDEwIH0gXSwgMC4xLCAxMDAsIDEwMDApXG4vL3NlZ21lbnRlZERvbWFpbihbIHsgbWluQ29vcmQ6IDEwMDAsIG1heENvb3JkOiAxMDEwIH0sIHsgbWluQ29vcmQ6IDIwMDAsIG1heENvb3JkOiAyMDUwIH0sIHsgbWluQ29vcmQ6IDYwMDAwLCBtYXhDb29yZDogNjAwMzAgfSBdLCAwLjEsIDEwMCwgMTAwMClcbmZ1bmN0aW9uIHNlZ21lbnRlZERvbWFpbihzZWdtZW50cywgcGFkZGluZywgYnVmZmVyLCB3aWR0aCkge1xuICAgIC8vIHBhZGRpbmcgLSBmcmFjdGlvbiBvZiB0aGUgZG9tYWluIHVzZWQgYXMgc2VnbWVudCBzZXBhcmF0b3JzXG4gICAgaWYgKHNlZ21lbnRzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgIHBhZGRpbmcgPSAwXG4gICAgfVxuICAgIHZhciBsZW5zID0gXy5tYXAoXG4gICAgICAgIHNlZ21lbnRzLFxuICAgICAgICBmdW5jdGlvbihzKSB7XG4gICAgICAgICAgICByZXR1cm4gcy5tYXhDb29yZCAtIHMubWluQ29vcmQgKyAxXG4gICAgICAgIH1cbiAgICApXG4gICAgdmFyIGN1bW1fbGVucyA9IF8ucmVkdWNlKFxuICAgICAgICBsZW5zLFxuICAgICAgICBmdW5jdGlvbihtLCBsKSB7XG4gICAgICAgICAgICBtLnB1c2gobVttLmxlbmd0aCAtIDFdICsgbClcbiAgICAgICAgICAgIHJldHVybiBtXG4gICAgICAgIH0sXG4gICAgICAgIFswXVxuICAgIClcbiAgICB2YXIgdnMgPSBfLm1hcChcbiAgICAgICAgY3VtbV9sZW5zLFxuICAgICAgICBmdW5jdGlvbihsKSB7XG4gICAgICAgICAgICByZXR1cm4gbCAqICgxIC0gcGFkZGluZykgLyBjdW1tX2xlbnNbY3VtbV9sZW5zLmxlbmd0aCAtIDFdXG4gICAgICAgIH1cbiAgICApXG4gICAgdmFyIHNlcCA9IHBhZGRpbmcgLyAoc2VnbWVudHMubGVuZ3RoIC0gMSlcbiAgICB2YXIgZG9tYWluID0gW11cbiAgICB2YXIgd3MgPSBbXVxuICAgIHZzLmZvckVhY2goZnVuY3Rpb24odiwgaykge1xuICAgICAgICBpZiAoayAhPT0gMCkge1xuICAgICAgICAgICAgZG9tYWluLnB1c2goc2VnbWVudHNbayAtIDFdLm1pbkNvb3JkKVxuICAgICAgICAgICAgZG9tYWluLnB1c2goc2VnbWVudHNbayAtIDFdLm1heENvb3JkKVxuICAgICAgICAgICAgd3MucHVzaCgoayAtIDEpICogc2VwICsgdnNbayAtIDFdKVxuICAgICAgICAgICAgd3MucHVzaCgoayAtIDEpICogc2VwICsgdilcbiAgICAgICAgfVxuICAgIH0pXG4gICAgdmFyIGYgPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAucmFuZ2UoW2J1ZmZlciAqIDEuNSAsIHdpZHRoIC0gYnVmZmVyXSlcbiAgICB2YXIgcmFuZ2UgPSBfLm1hcCh3cywgZilcbiAgICAvLyBjb25zb2xlLmxvZygnc2VnbWVudGVkRG9tYWluJywge1xuICAgIC8vICAgICBsZW5zOiBsZW5zLFxuICAgIC8vICAgICBjdW1tX2xlbnM6IGN1bW1fbGVucyxcbiAgICAvLyAgICAgdnM6IHZzLFxuICAgIC8vICAgICBzZXA6IHNlcCxcbiAgICAvLyAgICAgZG9tYWluOiBkb21haW4sXG4gICAgLy8gICAgIHdzOiB3cyxcbiAgICAvLyAgICAgcmFuZ2U6IHJhbmdlLFxuICAgIC8vIH0pXG4gICAgcmV0dXJuIGQzLnNjYWxlLmxpbmVhcigpXG4gICAgICAgIC5kb21haW4oZG9tYWluKVxuICAgICAgICAucmFuZ2UocmFuZ2UpXG4gICAgICAgIC8vLm5pY2UoKVxufVxuXG5NdXRzTmVlZGxlUGxvdC5wcm90b3R5cGUuZHJhd0xlZ2VuZCA9IGZ1bmN0aW9uKHN2Zykge1xuXG4gICAgLy8gTEVHRU5EXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gcHJlcGFyZSBsZWdlbmQgY2F0ZWdvcmllcyAoY29ycmVjdCBvcmRlcilcbiAgICB2YXIgbXV0Q2F0ZWdvcmllcyA9IFtdO1xuICAgIHZhciBjYXRlZ29yeUNvbG9ycyA9IFtdO1xuICAgIHZhciBhbGxjYXRlZ3MgPSBPYmplY3Qua2V5cyhzZWxmLnRvdGFsQ2F0ZWdDb3VudHMpOyAvLyByYW5kb20gb3JkZXJcbiAgICB2YXIgb3JkZXJlZERlY2xhcmF0aW9uID0gc2VsZi5jb2xvclNjYWxlLmRvbWFpbigpOyAgLy8gd2FudGVkIG9yZGVyXG4gICAgdmFyIGlkeFxuICAgIGZvciAoaWR4IGluIG9yZGVyZWREZWNsYXJhdGlvbikge1xuICAgICAgICB2YXIgYyA9IG9yZGVyZWREZWNsYXJhdGlvbltpZHhdO1xuICAgICAgICBpZiAoYWxsY2F0ZWdzLmluZGV4T2YoYykgPiAtMSkge1xuICAgICAgICAgICAgbXV0Q2F0ZWdvcmllcy5wdXNoKGMpO1xuICAgICAgICAgICAgY2F0ZWdvcnlDb2xvcnMucHVzaChzZWxmLmNvbG9yU2NhbGUoYykpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgc2NhbGUgd2l0aCBjb3JyZWN0IG9yZGVyIG9mIGNhdGVnb3JpZXNcbiAgICB2YXIgbXV0c1NjYWxlID0gc2VsZi5jb2xvclNjYWxlLmRvbWFpbihtdXRDYXRlZ29yaWVzKS5yYW5nZShjYXRlZ29yeUNvbG9ycyk7XG5cblxuICAgIHZhciBkb21haW4gPSBzZWxmLnguZG9tYWluKCk7XG4gICAgdmFyIHhwbGFjZW1lbnQgPSAoc2VsZi54KGRvbWFpblsxXSkgLSBzZWxmLngoZG9tYWluWzBdKSkgKiAwLjc1ICsgc2VsZi54KGRvbWFpblswXSk7XG5cblxuICAgIHZhciBzdW0gPSAwO1xuICAgIGZvciAodmFyIGMgaW4gc2VsZi50b3RhbENhdGVnQ291bnRzKSB7XG4gICAgICAgIHN1bSArPSBzZWxmLnRvdGFsQ2F0ZWdDb3VudHNbY107XG4gICAgfVxuXG4gICAgdmFyIGxlZ2VuZExhYmVsID0gZnVuY3Rpb24oY2F0ZWcpIHtcbiAgICAgICAgdmFyIGNvdW50ID0gKHNlbGYuY2F0ZWdDb3VudHNbY2F0ZWddIHx8IChzZWxmLnNlbGVjdGVkTmVlZGxlcy5sZW5ndGggPT0gMCAmJiBzZWxmLnRvdGFsQ2F0ZWdDb3VudHNbY2F0ZWddKSB8fCAwKTtcbiAgICAgICAgcmV0dXJuIGNhdGVnICsgKGNvdW50ID4gMCA/IFwiOiBcIitjb3VudCtcIiAoXCIgKyBNYXRoLnJvdW5kKGNvdW50L3N1bSoxMDApICsgXCIlKVwiIDogXCJcIik7XG4gICAgfTtcblxuICAgIHZhciBsZWdlbmRDbGFzcyA9IGZ1bmN0aW9uKGNhdGVnKSB7XG4gICAgICAgIHZhciBjb3VudCA9IChzZWxmLmNhdGVnQ291bnRzW2NhdGVnXSB8fCAoc2VsZi5zZWxlY3RlZE5lZWRsZXMubGVuZ3RoID09IDAgJiYgc2VsZi50b3RhbENhdGVnQ291bnRzW2NhdGVnXSkgfHwgMCk7XG4gICAgICAgIHJldHVybiAoY291bnQgPiAwKSA/IFwiXCIgOiBcIm5vbXV0c1wiO1xuICAgIH07XG5cbiAgICBzZWxmLm5vc2hvdyA9IFtdO1xuICAgIHZhciBuZWVkbGVIZWFkcyA9IHN2Zy5zZWxlY3RBbGwoXCIubmVlZGxlLWhlYWRcIik7XG4gICAgdmFyIHNob3dOb1Nob3cgPSBmdW5jdGlvbihjYXRlZyl7XG4gICAgICAgIGlmIChfLmNvbnRhaW5zKHNlbGYubm9zaG93LCBjYXRlZykpIHtcbiAgICAgICAgICAgIHNlbGYubm9zaG93ID0gXy5maWx0ZXIoc2VsZi5ub3Nob3csIGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHMgIT0gY2F0ZWcgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLm5vc2hvdy5wdXNoKGNhdGVnKTtcbiAgICAgICAgfVxuICAgICAgICBuZWVkbGVIZWFkcy5jbGFzc2VkKFwibm9zaG93XCIsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgICAgIHJldHVybiBfLmNvbnRhaW5zKHNlbGYubm9zaG93LCBkLmNhdGVnb3J5KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHZhciBsZWdlbmRDZWxscyA9IHN2Zy5zZWxlY3RBbGwoXCJnLmxlZ2VuZENlbGxzXCIpO1xuICAgICAgICBsZWdlbmRDZWxscy5jbGFzc2VkKFwibm9zaG93XCIsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgICAgIHJldHVybiBfLmNvbnRhaW5zKHNlbGYubm9zaG93LCBkLnN0b3BbMF0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG5cbiAgICB2YXIgdmVydGljYWxMZWdlbmQgPSBkMy5zdmcubGVnZW5kKClcbiAgICAgICAgLmxhYmVsRm9ybWF0KGxlZ2VuZExhYmVsKVxuICAgICAgICAubGFiZWxDbGFzcyhsZWdlbmRDbGFzcylcbiAgICAgICAgLm9uTGVnZW5kQ2xpY2soc2hvd05vU2hvdylcbiAgICAgICAgLmNlbGxQYWRkaW5nKDQpXG4gICAgICAgIC5vcmllbnRhdGlvbihcInZlcnRpY2FsXCIpXG4gICAgICAgIC51bml0cyhzdW0gKyBcIiBNdXRhdGlvbnNcIilcbiAgICAgICAgLmNlbGxXaWR0aCgyMClcbiAgICAgICAgLmNlbGxIZWlnaHQoMTIpXG4gICAgICAgIC5pbnB1dFNjYWxlKG11dHNTY2FsZSlcbiAgICAgICAgLmNlbGxTdGVwcGluZyg0KVxuICAgICAgICAucGxhY2Uoe3g6IHhwbGFjZW1lbnQsIHk6IDUwfSk7XG5cbiAgICBzZWxmLnZlcnRpY2FsTGVnZW5kID0gdmVydGljYWxMZWdlbmRcblxuICAgIHN2Zy5jYWxsKHZlcnRpY2FsTGVnZW5kKTtcblxufTtcblxuTXV0c05lZWRsZVBsb3QucHJvdG90eXBlLmRyYXdSZWdpb25zID0gZnVuY3Rpb24oc3ZnLCByZWdpb25EYXRhLCBub1JlZ2lvbkxhYmVscykge1xuXG4gICAgdmFyIG1heENvb3JkID0gdGhpcy5tYXhDb29yZDtcbiAgICB2YXIgbWluQ29vcmQgPSB0aGlzLm1pbkNvb3JkO1xuICAgIHZhciBidWZmZXIgPSB0aGlzLmJ1ZmZlcjtcbiAgICB2YXIgY29sb3JzID0gdGhpcy5jb2xvck1hcDtcbiAgICB2YXIgeSA9IHRoaXMueTtcbiAgICB2YXIgeCA9IHRoaXMueDtcblxuICAgIHZhciBiZWxvdyA9IHRydWU7XG5cbiAgICB2YXIgcmVnaW9uVGlwID0gdGhpcy5yZWdpb25UaXA7XG5cbiAgICBnZXRSZWdpb25TdGFydCA9IGZ1bmN0aW9uKHJlZ2lvbikge1xuICAgICAgICByZXR1cm4gcGFyc2VJbnQocmVnaW9uLnNwbGl0KFwiLVwiKVswXSlcbiAgICB9O1xuXG4gICAgZ2V0UmVnaW9uRW5kID0gZnVuY3Rpb24ocmVnaW9uKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUludChyZWdpb24uc3BsaXQoXCItXCIpWzFdKVxuICAgIH07XG5cbiAgICBnZXRDb2xvciA9IHRoaXMuY29sb3JTY2FsZTtcblxuICAgIHZhciBiZ19vZmZzZXQgPSAwO1xuICAgIHZhciByZWdpb25fb2Zmc2V0ID0gYmdfb2Zmc2V0LTNcbiAgICB2YXIgdGV4dF9vZmZzZXQgPSBiZ19vZmZzZXQgKyAyMDtcbiAgICBpZiAoYmVsb3cgIT0gdHJ1ZSkge1xuICAgICAgICB0ZXh0X29mZnNldCA9IGJnX29mZnNldCs1O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRyYXcocmVnaW9uTGlzdCkge1xuXG4gICAgICAgIHZhciByZWdpb25zQkcgPSBzdmcuc2VsZWN0QWxsKCkgLy8gZDMuc2VsZWN0KFwiLm11dG5lZWRsZXNcIikuc2VsZWN0QWxsKClcbiAgICAgICAgICAgIC5kYXRhKFtcImR1bW15XCJdKS5lbnRlcigpXG4gICAgICAgICAgICAuaW5zZXJ0KFwiZ1wiLCBcIjpmaXJzdC1jaGlsZFwiKVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInJlZ2lvbnNCR1wiKVxuICAgICAgICAgICAgLmFwcGVuZChcInJlY3RcIilcbiAgICAgICAgICAgIC5hdHRyKFwieFwiLCB4KG1pbkNvb3JkKSApXG4gICAgICAgICAgICAuYXR0cihcInlcIiwgeSgwKSArIGJnX29mZnNldCApXG4gICAgICAgICAgICAuYXR0cihcIndpZHRoXCIsIHgobWF4Q29vcmQpIC0geChtaW5Db29yZCkgKVxuICAgICAgICAgICAgLmF0dHIoXCJoZWlnaHRcIiwgMTApXG4gICAgICAgICAgICAuYXR0cihcImZpbGxcIiwgXCJsaWdodGdyZXlcIik7XG5cblxuICAgICAgICBzdmcuc2VsZWN0KFwiLmV4dGVudFwiKSAvLyBkMy5zZWxlY3QoXCIuZXh0ZW50XCIpXG4gICAgICAgICAgICAuYXR0cihcInlcIiwgeSgwKSArIHJlZ2lvbl9vZmZzZXQgLSAxMCk7XG5cblxuICAgICAgICB2YXIgcmVnaW9ucyA9IHJlZ2lvbnNCRyA9IHN2Zy5zZWxlY3RBbGwoKSAvLyBkMy5zZWxlY3QoXCIubXV0bmVlZGxlc1wiKS5zZWxlY3RBbGwoKVxuICAgICAgICAgICAgLmRhdGEocmVnaW9uTGlzdClcbiAgICAgICAgICAgIC5lbnRlcigpXG4gICAgICAgICAgICAuYXBwZW5kKFwiZ1wiKVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInJlZ2lvbkdyb3VwXCIpO1xuXG4gICAgICAgIHJlZ2lvbnMuYXBwZW5kKFwicmVjdFwiKVxuICAgICAgICAgICAgLmF0dHIoXCJ4XCIsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgoci5zdGFydCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmF0dHIoXCJ5XCIsIHkoMCkgKyByZWdpb25fb2Zmc2V0IClcbiAgICAgICAgICAgIC5hdHRyKFwicnlcIiwgXCIzXCIpXG4gICAgICAgICAgICAuYXR0cihcInJ4XCIsIFwiM1wiKVxuICAgICAgICAgICAgLmF0dHIoXCJ3aWR0aFwiLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgICAgIHJldHVybiB4KHIuZW5kKSAtIHgoci5zdGFydClcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuYXR0cihcImhlaWdodFwiLCAxNilcbiAgICAgICAgICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YS5jb2xvclxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5zdHlsZShcInN0cm9rZVwiLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkMy5yZ2IoZGF0YS5jb2xvcikuZGFya2VyKClcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsICBmdW5jdGlvbihkKXsgZDMuc2VsZWN0KHRoaXMpLm1vdmVUb0Zyb250KCk7IHJlZ2lvblRpcC5zaG93KGQpOyB9KVxuICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIHJlZ2lvblRpcC5oaWRlKTtcblxuICAgICAgICByZWdpb25zXG4gICAgICAgICAgICAuYXR0cigncG9pbnRlci1ldmVudHMnLCAnYWxsJylcbiAgICAgICAgICAgIC5hdHRyKCdjdXJzb3InLCAncG9pbnRlcicpXG4gICAgICAgICAgICAub24oXCJjbGlja1wiLCAgZnVuY3Rpb24ocikge1xuICAgICAgICAgICAgLy8gc2V0IGN1c3RvbSBzZWxlY3Rpb24gZXh0ZW50XG4gICAgICAgICAgICBzZWxmLnNlbGVjdG9yLmV4dGVudChbci5zdGFydCwgci5lbmRdKTtcbiAgICAgICAgICAgIC8vIGNhbGwgdGhlIGV4dGVudCB0byBjaGFuZ2Ugd2l0aCB0cmFuc2l0aW9uXG4gICAgICAgICAgICAvL3NlbGYuc2VsZWN0b3IoZDMuc2VsZWN0KFwiLmJydXNoXCIpLnRyYW5zaXRpb24oKSk7XG4gICAgICAgICAgICBzZWxmLnNlbGVjdG9yKHN2Zy50cmFuc2l0aW9uKCkpOyAvLyBzdmcgYWx3YXlzIGhhcyBjbGFzcyAnYnJ1c2gnP1xuICAgICAgICAgICAgLy8gY2FsbCBleHRlbnQgKHNlbGVjdGlvbikgY2hhbmdlIGxpc3RlbmVyc1xuICAgICAgICAgICAgLy9zZWxmLnNlbGVjdG9yLmV2ZW50KGQzLnNlbGVjdChcIi5icnVzaFwiKS50cmFuc2l0aW9uKCkuZGVsYXkoMzAwKSk7XG4gICAgICAgICAgICBzZWxmLnNlbGVjdG9yKHN2Zy50cmFuc2l0aW9uKCkuZGVsYXkoMzAwKSk7IC8vIHN2ZyBhbHdheXMgaGFzIGNsYXNzICdicnVzaCc/XG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCFub1JlZ2lvbkxhYmVscykge1xuICAgICAgICAgICAgLy8gUGxhY2UgYW5kIGxhYmVsIGxvY2F0aW9uXG4gICAgICAgICAgICB2YXIgbGFiZWxzID0gW107XG5cbiAgICAgICAgICAgIHZhciByZXBlYXRlZFJlZ2lvbiA9IHt9O1xuICAgICAgICAgICAgdmFyIGdldFJlZ2lvbkNsYXNzID0gZnVuY3Rpb24ocmVnaW9uKSB7XG4gICAgICAgICAgICAgICAgdmFyIGMgPSBcInJlZ2lvbk5hbWVcIjtcbiAgICAgICAgICAgICAgICB2YXIgcmVwZWF0ZWRDbGFzcyA9IFwiUlJfXCIrcmVnaW9uLm5hbWU7XG4gICAgICAgICAgICAgICAgaWYoXy5oYXMocmVwZWF0ZWRSZWdpb24sIHJlZ2lvbi5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBjID0gXCJyZXBlYXRlZE5hbWUgbm9zaG93IFwiICsgcmVwZWF0ZWRDbGFzcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVwZWF0ZWRSZWdpb25bcmVnaW9uLm5hbWVdID0gcmVwZWF0ZWRDbGFzcztcbiAgICAgICAgICAgICAgICByZXR1cm4gYztcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZWdpb25zLmFwcGVuZChcInRleHRcIilcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIGdldFJlZ2lvbkNsYXNzKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgICAgICAgICAgICAuYXR0cihcImZpbGxcIiwgXCJibGFja1wiKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwib3BhY2l0eVwiLCAwLjUpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJ4XCIsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgICAgIHIueCA9IHgoci5zdGFydCkgKyAoeChyLmVuZCkgLSB4KHIuc3RhcnQpKSAvIDI7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByLng7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuYXR0cihcInlcIiwgZnVuY3Rpb24ocikge3IueSA9IHkoMCkgKyB0ZXh0X29mZnNldDsgcmV0dXJuIHIueTsgfSApXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJkeVwiLCBcIjAuMzVlbVwiKVxuICAgICAgICAgICAgICAgIC5zdHlsZShcImZvbnQtc2l6ZVwiLCBcIjEycHhcIilcbiAgICAgICAgICAgICAgICAuc3R5bGUoXCJ0ZXh0LWRlY29yYXRpb25cIiwgXCJib2xkXCIpXG4gICAgICAgICAgICAgICAgLnRleHQoZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGEubmFtZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2YXIgcmVnaW9uTmFtZXMgPSBzdmcuc2VsZWN0QWxsKFwiLnJlZ2lvbk5hbWVcIik7IC8vIGQzLnNlbGVjdEFsbChcIi5yZWdpb25OYW1lXCIpO1xuICAgICAgICAgICAgcmVnaW9uTmFtZXMuZWFjaChmdW5jdGlvbihkLCBpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGludGVyYWN0aW9uTGVuZ3RoID0gdGhpcy5nZXRCQm94KCkud2lkdGggLyAyO1xuICAgICAgICAgICAgICAgIGxhYmVscy5wdXNoKHt4OiBkLngsIHk6IGQueSwgbGFiZWw6IGQubmFtZSwgd2VpZ2h0OiBkLm5hbWUubGVuZ3RoLCByYWRpdXM6IGludGVyYWN0aW9uTGVuZ3RofSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIGZvcmNlID0gZDMubGF5b3V0LmZvcmNlKClcbiAgICAgICAgICAgICAgICAuY2hhcmdlRGlzdGFuY2UoNSlcbiAgICAgICAgICAgICAgICAubm9kZXMobGFiZWxzKVxuICAgICAgICAgICAgICAgIC5jaGFyZ2UoLTEwKVxuICAgICAgICAgICAgICAgIC5ncmF2aXR5KDApO1xuXG4gICAgICAgICAgICB2YXIgbWluWCA9IHgobWluQ29vcmQpO1xuICAgICAgICAgICAgdmFyIG1heFggPSB4KG1heENvb3JkKTtcbiAgICAgICAgICAgIHZhciB3aXRoaW5Cb3VuZHMgPSBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGQzLm1pbihbXG4gICAgICAgICAgICAgICAgICAgIGQzLm1heChbXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5YLFxuICAgICAgICAgICAgICAgICAgICAgICAgeF0pLFxuICAgICAgICAgICAgICAgICAgICBtYXhYXG4gICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZnVuY3Rpb24gY29sbGlkZShub2RlKSB7XG4gICAgICAgICAgICAgICAgdmFyIHIgPSBub2RlLnJhZGl1cyArIDMsXG4gICAgICAgICAgICAgICAgICAgIG54MSA9IG5vZGUueCAtIHIsXG4gICAgICAgICAgICAgICAgICAgIG54MiA9IG5vZGUueCArIHIsXG4gICAgICAgICAgICAgICAgICAgIG55MSA9IG5vZGUueSAtIHIsXG4gICAgICAgICAgICAgICAgICAgIG55MiA9IG5vZGUueSArIHI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHF1YWQsIHgxLCB5MSwgeDIsIHkyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChxdWFkLnBvaW50ICYmIChxdWFkLnBvaW50ICE9PSBub2RlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGwgPSBub2RlLnggLSBxdWFkLnBvaW50LngsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGw7XG4gICAgICAgICAgICAgICAgICAgICAgICByID0gbm9kZS5yYWRpdXMgKyBxdWFkLnBvaW50LnJhZGl1cztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChNYXRoLmFicyhsKSA8IHIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsID0gKGwgLSByKSAvIGwgKiAuMDA1O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHggKj0gbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4ID0gIChub2RlLnggPiBxdWFkLnBvaW50LnggJiYgeCA8IDApID8gLXggOiB4O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUueCArPSB4O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1YWQucG9pbnQueCAtPSB4O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4MSA+IG54MlxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgeDIgPCBueDFcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IHkxID4gbnkyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCB5MiA8IG55MTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIG1vdmVSZXBlYXRlZExhYmVscyA9IGZ1bmN0aW9uKGxhYmVsLCB4KSB7XG4gICAgICAgICAgICAgICAgdmFyIG5hbWUgPSByZXBlYXRlZFJlZ2lvbltsYWJlbF07XG4gICAgICAgICAgICAgICAgc3ZnLnNlbGVjdEFsbChcInRleHQuXCIrbmFtZSlcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoXCJ4XCIsIG5ld3gpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGZvcmNlLm9uKFwidGlja1wiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgdmFyIHEgPSBkMy5nZW9tLnF1YWR0cmVlKGxhYmVscyksXG4gICAgICAgICAgICAgICAgICAgIGkgPSAwLFxuICAgICAgICAgICAgICAgICAgICBuID0gbGFiZWxzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoKytpIDwgbikge1xuICAgICAgICAgICAgICAgICAgICBxLnZpc2l0KGNvbGxpZGUobGFiZWxzW2ldKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgcG9zaXRpb24gb2YgdGhlIHRleHQgZWxlbWVudFxuICAgICAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgICAgICBzdmcuc2VsZWN0QWxsKFwidGV4dC5yZWdpb25OYW1lXCIpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKFwieFwiLCBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXd4ID0gbGFiZWxzW2krK10ueDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdmVSZXBlYXRlZExhYmVscyhkLm5hbWUsIG5ld3gpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld3g7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmb3JjZS5zdGFydCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0UmVnaW9ucyhyZWdpb25zKSB7XG4gICAgICAgIGZvciAoa2V5IGluIE9iamVjdC5rZXlzKHJlZ2lvbnMpKSB7XG5cbiAgICAgICAgICAgIHJlZ2lvbnNba2V5XS5zdGFydCA9IGdldFJlZ2lvblN0YXJ0KHJlZ2lvbnNba2V5XS5jb29yZCk7XG4gICAgICAgICAgICByZWdpb25zW2tleV0uZW5kID0gZ2V0UmVnaW9uRW5kKHJlZ2lvbnNba2V5XS5jb29yZCk7XG4gICAgICAgICAgICBpZiAocmVnaW9uc1trZXldLnN0YXJ0ID09IHJlZ2lvbnNba2V5XS5lbmQpIHtcbiAgICAgICAgICAgICAgICByZWdpb25zW2tleV0uc3RhcnQgLT0gMC40O1xuICAgICAgICAgICAgICAgIHJlZ2lvbnNba2V5XS5lbmQgKz0gMC40O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVnaW9uc1trZXldLmNvbG9yID0gZ2V0Q29sb3IocmVnaW9uc1trZXldLm5hbWUpO1xuICAgICAgICAgICAgLypyZWdpb25MaXN0LnB1c2goe1xuICAgICAgICAgICAgICAgICduYW1lJzoga2V5LFxuICAgICAgICAgICAgICAgICdzdGFydCc6IGdldFJlZ2lvblN0YXJ0KHJlZ2lvbnNba2V5XSksXG4gICAgICAgICAgICAgICAgJ2VuZCc6IGdldFJlZ2lvbkVuZChyZWdpb25zW2tleV0pLFxuICAgICAgICAgICAgICAgICdjb2xvcic6IGdldENvbG9yKGtleSlcbiAgICAgICAgICAgIH0pOyovXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlZ2lvbnM7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiByZWdpb25EYXRhID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgLy8gYXNzdW1lIGRhdGEgaXMgaW4gYSBmaWxlXG4gICAgICAgIGQzLmpzb24ocmVnaW9uRGF0YSwgZnVuY3Rpb24oZXJyb3IsIHJlZ2lvbnMpIHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge3JldHVybiBjb25zb2xlLmRlYnVnKGVycm9yKX1cbiAgICAgICAgICAgIHJlZ2lvbkxpc3QgPSBmb3JtYXRSZWdpb25zKHJlZ2lvbnMpO1xuICAgICAgICAgICAgZHJhdyhyZWdpb25MaXN0KTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVnaW9uTGlzdCA9IGZvcm1hdFJlZ2lvbnMocmVnaW9uRGF0YSk7XG4gICAgICAgIGRyYXcocmVnaW9uTGlzdCk7XG4gICAgfVxuXG59O1xuXG5cbk11dHNOZWVkbGVQbG90LnByb3RvdHlwZS5kcmF3QXhlcyA9IGZ1bmN0aW9uKHN2Zykge1xuXG4gICAgdmFyIHkgPSB0aGlzLnk7XG4gICAgdmFyIHggPSB0aGlzLng7XG5cbiAgICB4QXhpcyA9IGQzLnN2Zy5heGlzKCkuc2NhbGUoeCkub3JpZW50KFwiYm90dG9tXCIpO1xuXG4gICAgaWYgKHRoaXMuc2VnbWVudHMpIHtcbiAgICAgICAgeEF4aXMudGlja1ZhbHVlcyhcbiAgICAgICAgICAgIF8ubWFwKFxuICAgICAgICAgICAgICAgIGQzLnNjYWxlLmxpbmVhcigpLmRvbWFpbihbXG4gICAgICAgICAgICAgICAgICAgIHgodGhpcy5taW5Db29yZCksXG4gICAgICAgICAgICAgICAgICAgIHgodGhpcy5tYXhDb29yZCksXG4gICAgICAgICAgICAgICAgXSkudGlja3MoKSxcbiAgICAgICAgICAgICAgICAvLyBfLnJhbmdlKFxuICAgICAgICAgICAgICAgIC8vICAgICB4KHRoaXMubWluQ29vcmQpLFxuICAgICAgICAgICAgICAgIC8vICAgICB4KHRoaXMubWF4Q29vcmQpLFxuICAgICAgICAgICAgICAgIC8vICAgICAoeCh0aGlzLm1heENvb3JkKSAtIHgodGhpcy5taW5Db29yZCkpIC8gOFxuICAgICAgICAgICAgICAgIC8vICksXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24odikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5yb3VuZCh4LmludmVydCh2KSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApXG4gICAgICAgIClcbiAgICAgICAgY29uc29sZS5sb2coJ3RpY2tWYWx1ZXMnLCB4QXhpcywgdGhpcylcbiAgICB9XG5cbiAgICBzdmcuYXBwZW5kKFwic3ZnOmdcIilcbiAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ4LWF4aXMgYXhpc1wiKVxuICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCxcIiArICh0aGlzLmhlaWdodCAtIHRoaXMuYnVmZmVyKSArIFwiKVwiKVxuICAgICAgLmNhbGwoeEF4aXMpO1xuXG4gICAgeUF4aXMgPSBkMy5zdmcuYXhpcygpLnNjYWxlKHkpLm9yaWVudChcImxlZnRcIik7XG5cblxuICAgIHN2Zy5hcHBlbmQoXCJzdmc6Z1wiKVxuICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInktYXhpcyBheGlzXCIpXG4gICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArICh0aGlzLmJ1ZmZlciAqIDEuMiArIC0gMTApICArIFwiLDApXCIpXG4gICAgICAuY2FsbCh5QXhpcyk7XG5cbiAgICAvLyBhcHBlYXJhbmNlIGZvciB4IGFuZCB5IGxlZ2VuZFxuICAgIHN2Zy5zZWxlY3RBbGwoXCIuYXhpcyBwYXRoXCIpXG4gICAgICAgIC5hdHRyKCdmaWxsJywgJ25vbmUnKTtcbiAgICBzdmcuc2VsZWN0QWxsKFwiLmRvbWFpblwiKVxuICAgICAgICAuYXR0cignc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgICAgLmF0dHIoJ3N0cm9rZS13aWR0aCcsIDEpO1xuXG4gICAgc3ZnLmFwcGVuZChcInRleHRcIilcbiAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInktbGFiZWxcIilcbiAgICAgICAgLmF0dHIoXCJ0ZXh0LWFuY2hvclwiLCBcIm1pZGRsZVwiKVxuICAgICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArICh0aGlzLmJ1ZmZlciAvIDMpICsgXCIsXCIgKyAodGhpcy5oZWlnaHQgLyAyKSArIFwiKSwgcm90YXRlKC05MClcIilcbiAgICAgICAgLnRleHQodGhpcy5sZWdlbmRzLnkpXG4gICAgICAgIC5hdHRyKCdmb250LXdlaWdodCcsICdib2xkJylcbiAgICAgICAgLmF0dHIoJ2ZvbnQtc2l6ZScsIDEyKTtcblxuICAgIHN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcIngtbGFiZWxcIilcbiAgICAgICAgICAuYXR0cihcInRleHQtYW5jaG9yXCIsIFwibWlkZGxlXCIpXG4gICAgICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoXCIgKyAodGhpcy53aWR0aCAvIDIpICsgXCIsXCIgKyAodGhpcy5oZWlnaHQgLSB0aGlzLmJ1ZmZlciAvIDMpICsgXCIpXCIpXG4gICAgICAgICAgLnRleHQodGhpcy5sZWdlbmRzLngpXG4gICAgICAgIC5hdHRyKCdmb250LXdlaWdodCcsICdib2xkJylcbiAgICAgICAgLmF0dHIoJ2ZvbnQtc2l6ZScsIDEyKTtcbiAgICBcbn07XG5cblxuXG5NdXRzTmVlZGxlUGxvdC5wcm90b3R5cGUuZHJhd05lZWRsZXMgPSBmdW5jdGlvbihzdmcsIG11dGF0aW9uRGF0YSwgcmVnaW9uRGF0YSwgbm9SZWdpb25MYWJlbHMpIHtcblxuICAgIHZhciB5ID0gdGhpcy55O1xuICAgIHZhciB4ID0gdGhpcy54O1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBnZXRZQXhpcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4geTtcbiAgICB9O1xuXG4gICAgdmFyIGZvcm1hdENvb3JkID0gZnVuY3Rpb24oY29vcmQpIHtcbiAgICAgICBpZiAoY29vcmQuaW5kZXhPZihcIi1cIikgPiAtMSkge1xuICAgICAgICAgICBjb29yZHMgPSBjb29yZC5zcGxpdChcIi1cIik7XG5cbiAgICAgICAgICAgLy8gcGxhY2UgbmVlZGUgYXQgbWlkZGxlIG9mIGFmZmVjdGVkIHJlZ2lvblxuICAgICAgICAgICBjb29yZCA9IE1hdGguZmxvb3IoKHBhcnNlSW50KGNvb3Jkc1swXSkgKyBwYXJzZUludChjb29yZHNbMV0pKSAvIDIpO1xuXG4gICAgICAgICAgIC8vIGNoZWNrIGZvciBzcGxpY2Ugc2l0ZXM6IFwiPy05XCIgb3IgXCI5LT9cIlxuICAgICAgICAgICBpZiAoaXNOYU4oY29vcmQpKSB7XG4gICAgICAgICAgICAgICBpZiAoY29vcmRzWzBdID09IFwiP1wiKSB7IGNvb3JkID0gcGFyc2VJbnQoY29vcmRzWzFdKSB9XG4gICAgICAgICAgICAgICBlbHNlIGlmIChjb29yZHMgWzFdID09IFwiP1wiKSB7IGNvb3JkID0gcGFyc2VJbnQoY29vcmRzWzBdKSB9XG4gICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvb3JkID0gcGFyc2VJbnQoY29vcmQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb29yZDtcbiAgICB9O1xuXG4gICAgdmFyIHRpcCA9IHRoaXMudGlwO1xuXG4gICAgLy8gc3RhY2sgbmVlZGxlcyBhdCBzYW1lIHBvc1xuICAgIHZhciBuZWVkbGVQb2ludCA9IHt9O1xuICAgIHZhciBoaWdoZXN0ID0gMDtcblxuICAgIHZhciBzdGFja05lZWRsZSA9IGZ1bmN0aW9uKHBvcywgdmFsdWUsIHBvaW50RGljdCkge1xuICAgICAgICB2YXIgc3RpY2tIZWlnaHQgPSAwO1xuICAgICAgICBwb3MgPSAncCcgKyBTdHJpbmcocG9zKTtcbiAgICAgICAgaWYgKHBvcyBpbiBwb2ludERpY3QpIHtcbiAgICAgICAgICAgIHN0aWNrSGVpZ2h0ID0gcG9pbnREaWN0W3Bvc107XG4gICAgICAgICAgICBuZXdIZWlnaHQgPSBzdGlja0hlaWdodCArIHZhbHVlO1xuICAgICAgICAgICAgcG9pbnREaWN0W3Bvc10gPSBuZXdIZWlnaHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb2ludERpY3RbcG9zXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdGlja0hlaWdodDtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZm9ybWF0TXV0YXRpb25FbnRyeShkKSB7XG5cbiAgICAgICAgdmFyIGNvb3JkU3RyaW5nID0gZC5jb29yZDtcbiAgICAgICAgdmFyIG51bWVyaWNDb29yZCA9IGZvcm1hdENvb3JkKGQuY29vcmQpO1xuICAgICAgICB2YXIgbnVtZXJpY1ZhbHVlID0gTnVtYmVyKGQudmFsdWUpO1xuICAgICAgICB2YXIgc3RpY2tIZWlnaHQgPSBzdGFja05lZWRsZShudW1lcmljQ29vcmQsIG51bWVyaWNWYWx1ZSwgbmVlZGxlUG9pbnQpO1xuICAgICAgICB2YXIgY2F0ZWdvcnkgPSBkLmNhdGVnb3J5IHx8IFwib3RoZXJcIjtcblxuICAgICAgICBpZiAoc3RpY2tIZWlnaHQgKyBudW1lcmljVmFsdWUgPiBoaWdoZXN0KSB7XG4gICAgICAgICAgICAvLyBzZXQgWS1BeGlzIGFsd2F5cyB0byBoaWdoZXN0IGF2YWlsYWJsZVxuICAgICAgICAgICAgaGlnaGVzdCA9IHN0aWNrSGVpZ2h0ICsgbnVtZXJpY1ZhbHVlO1xuICAgICAgICAgICAgZ2V0WUF4aXMoKS5kb21haW4oWzAsIGhpZ2hlc3QgKyAyXSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmIChudW1lcmljQ29vcmQgPiAwKSB7XG5cbiAgICAgICAgICAgIC8vIHJlY29yZCBhbmQgY291bnQgY2F0ZWdvcmllc1xuICAgICAgICAgICAgc2VsZi50b3RhbENhdGVnQ291bnRzW2NhdGVnb3J5XSA9IChzZWxmLnRvdGFsQ2F0ZWdDb3VudHNbY2F0ZWdvcnldIHx8IDApICsgbnVtZXJpY1ZhbHVlO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICBjb29yZFN0cmluZzogY29vcmRTdHJpbmcsXG4gICAgICAgICAgICAgICAgY29vcmQ6IG51bWVyaWNDb29yZCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbnVtZXJpY1ZhbHVlLFxuICAgICAgICAgICAgICAgIHN0aWNrSGVpZ2h0OiBzdGlja0hlaWdodCxcbiAgICAgICAgICAgICAgICBjb2xvcjogc2VsZi5jb2xvclNjYWxlKGNhdGVnb3J5KSxcbiAgICAgICAgICAgICAgICBkYXRhOiBkLmRhdGEsXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmRlYnVnKFwiZGlzY2FyZGluZyBcIiArIGQuY29vcmQgKyBcIiBcIiArIGQuY2F0ZWdvcnkgKyBcIihcIisgbnVtZXJpY0Nvb3JkICtcIilcIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbXV0c1xuICAgIGlmICh0eXBlb2YgbXV0YXRpb25EYXRhID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgZDMuanNvbihtdXRhdGlvbkRhdGEsIGZ1bmN0aW9uKGVycm9yLCB1bmZvcm1hdHRlZE11dHMpIHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbXV0cyA9IHByZXBhcmVNdXRzKHVuZm9ybWF0dGVkTXV0cyk7XG4gICAgICAgICAgICBwYWludE11dHMobXV0cyk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG11dHMgPSBwcmVwYXJlTXV0cyhtdXRhdGlvbkRhdGEpO1xuICAgICAgICBwYWludE11dHMobXV0cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJlcGFyZU11dHModW5mb3JtYXR0ZWRNdXRzKSB7XG4gICAgICAgIHZhciBtdXRzID0gW11cbiAgICAgICAgdmFyIGtleVxuICAgICAgICBmb3IgKGtleSBpbiB1bmZvcm1hdHRlZE11dHMpIHtcbiAgICAgICAgICAgIHZhciBmb3JtYXR0ZWQgPSBmb3JtYXRNdXRhdGlvbkVudHJ5KHVuZm9ybWF0dGVkTXV0c1trZXldKTtcbiAgICAgICAgICAgIGlmIChmb3JtYXR0ZWQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbXV0cy5wdXNoKGZvcm1hdHRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG11dHM7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBwYWludE11dHMobXV0cykge1xuXG4gICAgICAgIHZhciBtaW5TaXplID0gNDtcbiAgICAgICAgdmFyIG1heFNpemUgPSAxMDtcbiAgICAgICAgdmFyIGhlYWRTaXplU2NhbGUgPSBkMy5zY2FsZS5sb2coKS5yYW5nZShbbWluU2l6ZSxtYXhTaXplXSkuZG9tYWluKFsxLCBoaWdoZXN0LzJdKTtcbiAgICAgICAgdmFyIGhlYWRTaXplID0gZnVuY3Rpb24obikge1xuICAgICAgICAgICAgcmV0dXJuIGQzLm1pbihbZDMubWF4KFtoZWFkU2l6ZVNjYWxlKG4pLG1pblNpemVdKSwgbWF4U2l6ZV0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBuZWVkbGVzID0gc3ZnLnNlbGVjdEFsbCgpIC8vIGQzLnNlbGVjdChcIi5tdXRuZWVkbGVzXCIpLnNlbGVjdEFsbCgpXG4gICAgICAgICAgICAuZGF0YShtdXRzKS5lbnRlcigpXG4gICAgICAgICAgICAuYXBwZW5kKFwibGluZVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJ5MVwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiB5KGRhdGEuc3RpY2tIZWlnaHQgKyBkYXRhLnZhbHVlKSArIGhlYWRTaXplKGRhdGEudmFsdWUpIDsgfSApXG4gICAgICAgICAgICAuYXR0cihcInkyXCIsIGZ1bmN0aW9uKGRhdGEpIHsgcmV0dXJuIHkoZGF0YS5zdGlja0hlaWdodCkgfSlcbiAgICAgICAgICAgIC5hdHRyKFwieDFcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geChkYXRhLmNvb3JkKSB9KVxuICAgICAgICAgICAgLmF0dHIoXCJ4MlwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiB4KGRhdGEuY29vcmQpIH0pXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwibmVlZGxlLWxpbmVcIilcbiAgICAgICAgICAgIC5hdHRyKFwic3Ryb2tlXCIsIFwiYmxhY2tcIilcbiAgICAgICAgICAgIC5hdHRyKFwic3Ryb2tlLXdpZHRoXCIsIDEpO1xuXG4gICAgICAgIHZhciBuZWVkbGVIZWFkcyA9IHN2Zy5zZWxlY3RBbGwoKSAvLyBkMy5zZWxlY3QoXCIubXV0bmVlZGxlc1wiKS5zZWxlY3RBbGwoKVxuICAgICAgICAgICAgLmRhdGEobXV0cylcbiAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZChcImNpcmNsZVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJjeVwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiB5KGRhdGEuc3RpY2tIZWlnaHQrZGF0YS52YWx1ZSkgfSApXG4gICAgICAgICAgICAuYXR0cihcImN4XCIsIGZ1bmN0aW9uKGRhdGEpIHsgcmV0dXJuIHgoZGF0YS5jb29yZCkgfSApXG4gICAgICAgICAgICAuYXR0cihcInJcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4gaGVhZFNpemUoZGF0YS52YWx1ZSkgfSlcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJuZWVkbGUtaGVhZFwiKVxuICAgICAgICAgICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiBkYXRhLmNvbG9yIH0pXG4gICAgICAgICAgICAuc3R5bGUoXCJzdHJva2VcIiwgZnVuY3Rpb24oZGF0YSkge3JldHVybiBkMy5yZ2IoZGF0YS5jb2xvcikuZGFya2VyKCl9KVxuICAgICAgICAgICAgLm9uKCdtb3VzZW92ZXInLCAgZnVuY3Rpb24oZCl7IGQzLnNlbGVjdCh0aGlzKS5tb3ZlVG9Gcm9udCgpOyB0aXAuc2hvdyhkKTsgfSlcbiAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCB0aXAuaGlkZSk7XG5cbiAgICAgICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5tb3ZlVG9Gcm9udCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGFkanVzdCB5LXNjYWxlIGFjY29yZGluZyB0byBoaWdoZXN0IHZhbHVlIGFuIGRyYXcgdGhlIHJlc3RcbiAgICAgICAgaWYgKHJlZ2lvbkRhdGEgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzZWxmLmRyYXdSZWdpb25zKHN2ZywgcmVnaW9uRGF0YSwgbm9SZWdpb25MYWJlbHMpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuZHJhd0xlZ2VuZChzdmcpO1xuICAgICAgICBzZWxmLmRyYXdBeGVzKHN2Zyk7XG5cbiAgICAgICAgLyogQnJpbmcgbmVlZGxlIGhlYWRzIGluIGZyb250IG9mIHJlZ2lvbnMgKi9cbiAgICAgICAgbmVlZGxlSGVhZHMuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG59O1xuXG5cblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJ2Jpb2pzLWV2ZW50cycpO1xuRXZlbnRzLm1peGluKE11dHNOZWVkbGVQbG90LnByb3RvdHlwZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTXV0c05lZWRsZVBsb3Q7XG5cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vc3JjL2pzL011dHNOZWVkbGVQbG90LmpzXCIpO1xuIl19
