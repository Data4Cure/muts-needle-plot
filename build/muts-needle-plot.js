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


    this.tip = d3.tip()
      .attr('class', 'muts-needle-plot d3-tip d3-tip-needle')
      .offset([-10, 0])
      .html(function(d) {
        return "<span>" + d.value + " " + d.category +  " at coord. " + d.coordString + "</span>";
      });

    this.selectionTip = d3.tip()
        .attr('class', 'muts-needle-plot d3-tip d3-tip-selection')
        .offset([-50, 0])
        .html(function(d) {
            return "<span> Selected coordinates<br/>" + Math.round(d.left) + " - " + Math.round(d.right) + "</span>";
        })
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

    // DEFINE SCALES

    var x = d3.scale.linear()
      .domain([this.minCoord, this.maxCoord])
      .range([buffer * 1.5 , width - buffer])
      .nice();
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
    this.drawNeedles(svg, mutationData, regionData);


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

MutsNeedlePlot.prototype.drawRegions = function(svg, regionData) {

    var maxCoord = this.maxCoord;
    var minCoord = this.minCoord;
    var buffer = this.buffer;
    var colors = this.colorMap;
    var y = this.y;
    var x = this.x;

    var below = true;


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
            });

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



MutsNeedlePlot.prototype.drawNeedles = function(svg, mutationData, regionData) {

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
                color: self.colorScale(category)
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
            self.drawRegions(svg, regionData);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9ib2drbHVnL2Q0Yy9tdXRzLW5lZWRsZS1wbG90L25vZGVfbW9kdWxlcy9iaW9qcy1ldmVudHMvaW5kZXguanMiLCIvaG9tZS9ib2drbHVnL2Q0Yy9tdXRzLW5lZWRsZS1wbG90L25vZGVfbW9kdWxlcy9iaW9qcy1ldmVudHMvbm9kZV9tb2R1bGVzL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lLmpzIiwiL2hvbWUvYm9na2x1Zy9kNGMvbXV0cy1uZWVkbGUtcGxvdC9ub2RlX21vZHVsZXMvYmlvanMtZXZlbnRzL25vZGVfbW9kdWxlcy9iYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZS9pbmRleC5qcyIsIi9ob21lL2JvZ2tsdWcvZDRjL211dHMtbmVlZGxlLXBsb3Qvbm9kZV9tb2R1bGVzL2QzLXRpcC9pbmRleC5qcyIsIi9ob21lL2JvZ2tsdWcvZDRjL211dHMtbmVlZGxlLXBsb3Qvc3JjL2pzL011dHNOZWVkbGVQbG90LmpzIiwiLi9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsdUJBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGV2ZW50cyA9IHJlcXVpcmUoXCJiYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZVwiKTtcblxuZXZlbnRzLm9uQWxsID0gZnVuY3Rpb24oY2FsbGJhY2ssY29udGV4dCl7XG4gIHRoaXMub24oXCJhbGxcIiwgY2FsbGJhY2ssY29udGV4dCk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gTWl4aW4gdXRpbGl0eVxuZXZlbnRzLm9sZE1peGluID0gZXZlbnRzLm1peGluO1xuZXZlbnRzLm1peGluID0gZnVuY3Rpb24ocHJvdG8pIHtcbiAgZXZlbnRzLm9sZE1peGluKHByb3RvKTtcbiAgLy8gYWRkIGN1c3RvbSBvbkFsbFxuICB2YXIgZXhwb3J0cyA9IFsnb25BbGwnXTtcbiAgZm9yKHZhciBpPTA7IGkgPCBleHBvcnRzLmxlbmd0aDtpKyspe1xuICAgIHZhciBuYW1lID0gZXhwb3J0c1tpXTtcbiAgICBwcm90b1tuYW1lXSA9IHRoaXNbbmFtZV07XG4gIH1cbiAgcmV0dXJuIHByb3RvO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBldmVudHM7XG4iLCIvKipcbiAqIFN0YW5kYWxvbmUgZXh0cmFjdGlvbiBvZiBCYWNrYm9uZS5FdmVudHMsIG5vIGV4dGVybmFsIGRlcGVuZGVuY3kgcmVxdWlyZWQuXG4gKiBEZWdyYWRlcyBuaWNlbHkgd2hlbiBCYWNrb25lL3VuZGVyc2NvcmUgYXJlIGFscmVhZHkgYXZhaWxhYmxlIGluIHRoZSBjdXJyZW50XG4gKiBnbG9iYWwgY29udGV4dC5cbiAqXG4gKiBOb3RlIHRoYXQgZG9jcyBzdWdnZXN0IHRvIHVzZSB1bmRlcnNjb3JlJ3MgYF8uZXh0ZW5kKClgIG1ldGhvZCB0byBhZGQgRXZlbnRzXG4gKiBzdXBwb3J0IHRvIHNvbWUgZ2l2ZW4gb2JqZWN0LiBBIGBtaXhpbigpYCBtZXRob2QgaGFzIGJlZW4gYWRkZWQgdG8gdGhlIEV2ZW50c1xuICogcHJvdG90eXBlIHRvIGF2b2lkIHVzaW5nIHVuZGVyc2NvcmUgZm9yIHRoYXQgc29sZSBwdXJwb3NlOlxuICpcbiAqICAgICB2YXIgbXlFdmVudEVtaXR0ZXIgPSBCYWNrYm9uZUV2ZW50cy5taXhpbih7fSk7XG4gKlxuICogT3IgZm9yIGEgZnVuY3Rpb24gY29uc3RydWN0b3I6XG4gKlxuICogICAgIGZ1bmN0aW9uIE15Q29uc3RydWN0b3IoKXt9XG4gKiAgICAgTXlDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZm9vID0gZnVuY3Rpb24oKXt9XG4gKiAgICAgQmFja2JvbmVFdmVudHMubWl4aW4oTXlDb25zdHJ1Y3Rvci5wcm90b3R5cGUpO1xuICpcbiAqIChjKSAyMDA5LTIwMTMgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIEluYy5cbiAqIChjKSAyMDEzIE5pY29sYXMgUGVycmlhdWx0XG4gKi9cbi8qIGdsb2JhbCBleHBvcnRzOnRydWUsIGRlZmluZSwgbW9kdWxlICovXG4oZnVuY3Rpb24oKSB7XG4gIHZhciByb290ID0gdGhpcyxcbiAgICAgIG5hdGl2ZUZvckVhY2ggPSBBcnJheS5wcm90b3R5cGUuZm9yRWFjaCxcbiAgICAgIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSxcbiAgICAgIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLFxuICAgICAgaWRDb3VudGVyID0gMDtcblxuICAvLyBSZXR1cm5zIGEgcGFydGlhbCBpbXBsZW1lbnRhdGlvbiBtYXRjaGluZyB0aGUgbWluaW1hbCBBUEkgc3Vic2V0IHJlcXVpcmVkXG4gIC8vIGJ5IEJhY2tib25lLkV2ZW50c1xuICBmdW5jdGlvbiBtaW5pc2NvcmUoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleXM6IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmogIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG9iaiAhPT0gXCJmdW5jdGlvblwiIHx8IG9iaiA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJrZXlzKCkgY2FsbGVkIG9uIGEgbm9uLW9iamVjdFwiKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIga2V5LCBrZXlzID0gW107XG4gICAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAga2V5c1trZXlzLmxlbmd0aF0gPSBrZXk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgICAgfSxcblxuICAgICAgdW5pcXVlSWQ6IGZ1bmN0aW9uKHByZWZpeCkge1xuICAgICAgICB2YXIgaWQgPSArK2lkQ291bnRlciArICcnO1xuICAgICAgICByZXR1cm4gcHJlZml4ID8gcHJlZml4ICsgaWQgOiBpZDtcbiAgICAgIH0sXG5cbiAgICAgIGhhczogZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgICAgICAgcmV0dXJuIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xuICAgICAgfSxcblxuICAgICAgZWFjaDogZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgICBpZiAob2JqID09IG51bGwpIHJldHVybjtcbiAgICAgICAgaWYgKG5hdGl2ZUZvckVhY2ggJiYgb2JqLmZvckVhY2ggPT09IG5hdGl2ZUZvckVhY2gpIHtcbiAgICAgICAgICBvYmouZm9yRWFjaChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IG9iai5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXMob2JqLCBrZXkpKSB7XG4gICAgICAgICAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2tleV0sIGtleSwgb2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIG9uY2U6IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICAgICAgdmFyIHJhbiA9IGZhbHNlLCBtZW1vO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHJhbikgcmV0dXJuIG1lbW87XG4gICAgICAgICAgcmFuID0gdHJ1ZTtcbiAgICAgICAgICBtZW1vID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgIGZ1bmMgPSBudWxsO1xuICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICB2YXIgXyA9IG1pbmlzY29yZSgpLCBFdmVudHM7XG5cbiAgLy8gQmFja2JvbmUuRXZlbnRzXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEEgbW9kdWxlIHRoYXQgY2FuIGJlIG1peGVkIGluIHRvICphbnkgb2JqZWN0KiBpbiBvcmRlciB0byBwcm92aWRlIGl0IHdpdGhcbiAgLy8gY3VzdG9tIGV2ZW50cy4gWW91IG1heSBiaW5kIHdpdGggYG9uYCBvciByZW1vdmUgd2l0aCBgb2ZmYCBjYWxsYmFja1xuICAvLyBmdW5jdGlvbnMgdG8gYW4gZXZlbnQ7IGB0cmlnZ2VyYC1pbmcgYW4gZXZlbnQgZmlyZXMgYWxsIGNhbGxiYWNrcyBpblxuICAvLyBzdWNjZXNzaW9uLlxuICAvL1xuICAvLyAgICAgdmFyIG9iamVjdCA9IHt9O1xuICAvLyAgICAgXy5leHRlbmQob2JqZWN0LCBCYWNrYm9uZS5FdmVudHMpO1xuICAvLyAgICAgb2JqZWN0Lm9uKCdleHBhbmQnLCBmdW5jdGlvbigpeyBhbGVydCgnZXhwYW5kZWQnKTsgfSk7XG4gIC8vICAgICBvYmplY3QudHJpZ2dlcignZXhwYW5kJyk7XG4gIC8vXG4gIEV2ZW50cyA9IHtcblxuICAgIC8vIEJpbmQgYW4gZXZlbnQgdG8gYSBgY2FsbGJhY2tgIGZ1bmN0aW9uLiBQYXNzaW5nIGBcImFsbFwiYCB3aWxsIGJpbmRcbiAgICAvLyB0aGUgY2FsbGJhY2sgdG8gYWxsIGV2ZW50cyBmaXJlZC5cbiAgICBvbjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICdvbicsIG5hbWUsIFtjYWxsYmFjaywgY29udGV4dF0pIHx8ICFjYWxsYmFjaykgcmV0dXJuIHRoaXM7XG4gICAgICB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcbiAgICAgIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV0gfHwgKHRoaXMuX2V2ZW50c1tuYW1lXSA9IFtdKTtcbiAgICAgIGV2ZW50cy5wdXNoKHtjYWxsYmFjazogY2FsbGJhY2ssIGNvbnRleHQ6IGNvbnRleHQsIGN0eDogY29udGV4dCB8fCB0aGlzfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLy8gQmluZCBhbiBldmVudCB0byBvbmx5IGJlIHRyaWdnZXJlZCBhIHNpbmdsZSB0aW1lLiBBZnRlciB0aGUgZmlyc3QgdGltZVxuICAgIC8vIHRoZSBjYWxsYmFjayBpcyBpbnZva2VkLCBpdCB3aWxsIGJlIHJlbW92ZWQuXG4gICAgb25jZTogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICdvbmNlJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkgfHwgIWNhbGxiYWNrKSByZXR1cm4gdGhpcztcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciBvbmNlID0gXy5vbmNlKGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLm9mZihuYW1lLCBvbmNlKTtcbiAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH0pO1xuICAgICAgb25jZS5fY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICAgIHJldHVybiB0aGlzLm9uKG5hbWUsIG9uY2UsIGNvbnRleHQpO1xuICAgIH0sXG5cbiAgICAvLyBSZW1vdmUgb25lIG9yIG1hbnkgY2FsbGJhY2tzLiBJZiBgY29udGV4dGAgaXMgbnVsbCwgcmVtb3ZlcyBhbGxcbiAgICAvLyBjYWxsYmFja3Mgd2l0aCB0aGF0IGZ1bmN0aW9uLiBJZiBgY2FsbGJhY2tgIGlzIG51bGwsIHJlbW92ZXMgYWxsXG4gICAgLy8gY2FsbGJhY2tzIGZvciB0aGUgZXZlbnQuIElmIGBuYW1lYCBpcyBudWxsLCByZW1vdmVzIGFsbCBib3VuZFxuICAgIC8vIGNhbGxiYWNrcyBmb3IgYWxsIGV2ZW50cy5cbiAgICBvZmY6IGZ1bmN0aW9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgICB2YXIgcmV0YWluLCBldiwgZXZlbnRzLCBuYW1lcywgaSwgbCwgaiwgaztcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzIHx8ICFldmVudHNBcGkodGhpcywgJ29mZicsIG5hbWUsIFtjYWxsYmFjaywgY29udGV4dF0pKSByZXR1cm4gdGhpcztcbiAgICAgIGlmICghbmFtZSAmJiAhY2FsbGJhY2sgJiYgIWNvbnRleHQpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuXG4gICAgICBuYW1lcyA9IG5hbWUgPyBbbmFtZV0gOiBfLmtleXModGhpcy5fZXZlbnRzKTtcbiAgICAgIGZvciAoaSA9IDAsIGwgPSBuYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgbmFtZSA9IG5hbWVzW2ldO1xuICAgICAgICBpZiAoZXZlbnRzID0gdGhpcy5fZXZlbnRzW25hbWVdKSB7XG4gICAgICAgICAgdGhpcy5fZXZlbnRzW25hbWVdID0gcmV0YWluID0gW107XG4gICAgICAgICAgaWYgKGNhbGxiYWNrIHx8IGNvbnRleHQpIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDAsIGsgPSBldmVudHMubGVuZ3RoOyBqIDwgazsgaisrKSB7XG4gICAgICAgICAgICAgIGV2ID0gZXZlbnRzW2pdO1xuICAgICAgICAgICAgICBpZiAoKGNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBldi5jYWxsYmFjayAmJiBjYWxsYmFjayAhPT0gZXYuY2FsbGJhY2suX2NhbGxiYWNrKSB8fFxuICAgICAgICAgICAgICAgICAgKGNvbnRleHQgJiYgY29udGV4dCAhPT0gZXYuY29udGV4dCkpIHtcbiAgICAgICAgICAgICAgICByZXRhaW4ucHVzaChldik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFyZXRhaW4ubGVuZ3RoKSBkZWxldGUgdGhpcy5fZXZlbnRzW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBUcmlnZ2VyIG9uZSBvciBtYW55IGV2ZW50cywgZmlyaW5nIGFsbCBib3VuZCBjYWxsYmFja3MuIENhbGxiYWNrcyBhcmVcbiAgICAvLyBwYXNzZWQgdGhlIHNhbWUgYXJndW1lbnRzIGFzIGB0cmlnZ2VyYCBpcywgYXBhcnQgZnJvbSB0aGUgZXZlbnQgbmFtZVxuICAgIC8vICh1bmxlc3MgeW91J3JlIGxpc3RlbmluZyBvbiBgXCJhbGxcImAsIHdoaWNoIHdpbGwgY2F1c2UgeW91ciBjYWxsYmFjayB0b1xuICAgIC8vIHJlY2VpdmUgdGhlIHRydWUgbmFtZSBvZiB0aGUgZXZlbnQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50KS5cbiAgICB0cmlnZ2VyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50cykgcmV0dXJuIHRoaXM7XG4gICAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICd0cmlnZ2VyJywgbmFtZSwgYXJncykpIHJldHVybiB0aGlzO1xuICAgICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXTtcbiAgICAgIHZhciBhbGxFdmVudHMgPSB0aGlzLl9ldmVudHMuYWxsO1xuICAgICAgaWYgKGV2ZW50cykgdHJpZ2dlckV2ZW50cyhldmVudHMsIGFyZ3MpO1xuICAgICAgaWYgKGFsbEV2ZW50cykgdHJpZ2dlckV2ZW50cyhhbGxFdmVudHMsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLy8gVGVsbCB0aGlzIG9iamVjdCB0byBzdG9wIGxpc3RlbmluZyB0byBlaXRoZXIgc3BlY2lmaWMgZXZlbnRzIC4uLiBvclxuICAgIC8vIHRvIGV2ZXJ5IG9iamVjdCBpdCdzIGN1cnJlbnRseSBsaXN0ZW5pbmcgdG8uXG4gICAgc3RvcExpc3RlbmluZzogZnVuY3Rpb24ob2JqLCBuYW1lLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICAgIGlmICghbGlzdGVuZXJzKSByZXR1cm4gdGhpcztcbiAgICAgIHZhciBkZWxldGVMaXN0ZW5lciA9ICFuYW1lICYmICFjYWxsYmFjaztcbiAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIGNhbGxiYWNrID0gdGhpcztcbiAgICAgIGlmIChvYmopIChsaXN0ZW5lcnMgPSB7fSlbb2JqLl9saXN0ZW5lcklkXSA9IG9iajtcbiAgICAgIGZvciAodmFyIGlkIGluIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lcnNbaWRdLm9mZihuYW1lLCBjYWxsYmFjaywgdGhpcyk7XG4gICAgICAgIGlmIChkZWxldGVMaXN0ZW5lcikgZGVsZXRlIHRoaXMuX2xpc3RlbmVyc1tpZF07XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgfTtcblxuICAvLyBSZWd1bGFyIGV4cHJlc3Npb24gdXNlZCB0byBzcGxpdCBldmVudCBzdHJpbmdzLlxuICB2YXIgZXZlbnRTcGxpdHRlciA9IC9cXHMrLztcblxuICAvLyBJbXBsZW1lbnQgZmFuY3kgZmVhdHVyZXMgb2YgdGhlIEV2ZW50cyBBUEkgc3VjaCBhcyBtdWx0aXBsZSBldmVudFxuICAvLyBuYW1lcyBgXCJjaGFuZ2UgYmx1clwiYCBhbmQgalF1ZXJ5LXN0eWxlIGV2ZW50IG1hcHMgYHtjaGFuZ2U6IGFjdGlvbn1gXG4gIC8vIGluIHRlcm1zIG9mIHRoZSBleGlzdGluZyBBUEkuXG4gIHZhciBldmVudHNBcGkgPSBmdW5jdGlvbihvYmosIGFjdGlvbiwgbmFtZSwgcmVzdCkge1xuICAgIGlmICghbmFtZSkgcmV0dXJuIHRydWU7XG5cbiAgICAvLyBIYW5kbGUgZXZlbnQgbWFwcy5cbiAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICBmb3IgKHZhciBrZXkgaW4gbmFtZSkge1xuICAgICAgICBvYmpbYWN0aW9uXS5hcHBseShvYmosIFtrZXksIG5hbWVba2V5XV0uY29uY2F0KHJlc3QpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgc3BhY2Ugc2VwYXJhdGVkIGV2ZW50IG5hbWVzLlxuICAgIGlmIChldmVudFNwbGl0dGVyLnRlc3QobmFtZSkpIHtcbiAgICAgIHZhciBuYW1lcyA9IG5hbWUuc3BsaXQoZXZlbnRTcGxpdHRlcik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBvYmpbYWN0aW9uXS5hcHBseShvYmosIFtuYW1lc1tpXV0uY29uY2F0KHJlc3QpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBBIGRpZmZpY3VsdC10by1iZWxpZXZlLCBidXQgb3B0aW1pemVkIGludGVybmFsIGRpc3BhdGNoIGZ1bmN0aW9uIGZvclxuICAvLyB0cmlnZ2VyaW5nIGV2ZW50cy4gVHJpZXMgdG8ga2VlcCB0aGUgdXN1YWwgY2FzZXMgc3BlZWR5IChtb3N0IGludGVybmFsXG4gIC8vIEJhY2tib25lIGV2ZW50cyBoYXZlIDMgYXJndW1lbnRzKS5cbiAgdmFyIHRyaWdnZXJFdmVudHMgPSBmdW5jdGlvbihldmVudHMsIGFyZ3MpIHtcbiAgICB2YXIgZXYsIGkgPSAtMSwgbCA9IGV2ZW50cy5sZW5ndGgsIGExID0gYXJnc1swXSwgYTIgPSBhcmdzWzFdLCBhMyA9IGFyZ3NbMl07XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAwOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCk7IHJldHVybjtcbiAgICAgIGNhc2UgMTogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suY2FsbChldi5jdHgsIGExKTsgcmV0dXJuO1xuICAgICAgY2FzZSAyOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEsIGEyKTsgcmV0dXJuO1xuICAgICAgY2FzZSAzOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEsIGEyLCBhMyk7IHJldHVybjtcbiAgICAgIGRlZmF1bHQ6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmFwcGx5KGV2LmN0eCwgYXJncyk7XG4gICAgfVxuICB9O1xuXG4gIHZhciBsaXN0ZW5NZXRob2RzID0ge2xpc3RlblRvOiAnb24nLCBsaXN0ZW5Ub09uY2U6ICdvbmNlJ307XG5cbiAgLy8gSW52ZXJzaW9uLW9mLWNvbnRyb2wgdmVyc2lvbnMgb2YgYG9uYCBhbmQgYG9uY2VgLiBUZWxsICp0aGlzKiBvYmplY3QgdG9cbiAgLy8gbGlzdGVuIHRvIGFuIGV2ZW50IGluIGFub3RoZXIgb2JqZWN0IC4uLiBrZWVwaW5nIHRyYWNrIG9mIHdoYXQgaXQnc1xuICAvLyBsaXN0ZW5pbmcgdG8uXG4gIF8uZWFjaChsaXN0ZW5NZXRob2RzLCBmdW5jdGlvbihpbXBsZW1lbnRhdGlvbiwgbWV0aG9kKSB7XG4gICAgRXZlbnRzW21ldGhvZF0gPSBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzIHx8ICh0aGlzLl9saXN0ZW5lcnMgPSB7fSk7XG4gICAgICB2YXIgaWQgPSBvYmouX2xpc3RlbmVySWQgfHwgKG9iai5fbGlzdGVuZXJJZCA9IF8udW5pcXVlSWQoJ2wnKSk7XG4gICAgICBsaXN0ZW5lcnNbaWRdID0gb2JqO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgICAgb2JqW2ltcGxlbWVudGF0aW9uXShuYW1lLCBjYWxsYmFjaywgdGhpcyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICB9KTtcblxuICAvLyBBbGlhc2VzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgRXZlbnRzLmJpbmQgICA9IEV2ZW50cy5vbjtcbiAgRXZlbnRzLnVuYmluZCA9IEV2ZW50cy5vZmY7XG5cbiAgLy8gTWl4aW4gdXRpbGl0eVxuICBFdmVudHMubWl4aW4gPSBmdW5jdGlvbihwcm90bykge1xuICAgIHZhciBleHBvcnRzID0gWydvbicsICdvbmNlJywgJ29mZicsICd0cmlnZ2VyJywgJ3N0b3BMaXN0ZW5pbmcnLCAnbGlzdGVuVG8nLFxuICAgICAgICAgICAgICAgICAgICdsaXN0ZW5Ub09uY2UnLCAnYmluZCcsICd1bmJpbmQnXTtcbiAgICBfLmVhY2goZXhwb3J0cywgZnVuY3Rpb24obmFtZSkge1xuICAgICAgcHJvdG9bbmFtZV0gPSB0aGlzW25hbWVdO1xuICAgIH0sIHRoaXMpO1xuICAgIHJldHVybiBwcm90bztcbiAgfTtcblxuICAvLyBFeHBvcnQgRXZlbnRzIGFzIEJhY2tib25lRXZlbnRzIGRlcGVuZGluZyBvbiBjdXJyZW50IGNvbnRleHRcbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gRXZlbnRzO1xuICAgIH1cbiAgICBleHBvcnRzLkJhY2tib25lRXZlbnRzID0gRXZlbnRzO1xuICB9ZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSBcIm9iamVjdFwiKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEV2ZW50cztcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByb290LkJhY2tib25lRXZlbnRzID0gRXZlbnRzO1xuICB9XG59KSh0aGlzKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9iYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZScpO1xuIiwiLy8gZDMudGlwXG4vLyBDb3B5cmlnaHQgKGMpIDIwMTMgSnVzdGluIFBhbG1lclxuLy9cbi8vIFRvb2x0aXBzIGZvciBkMy5qcyBTVkcgdmlzdWFsaXphdGlvbnNcblxuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUgd2l0aCBkMyBhcyBhIGRlcGVuZGVuY3kuXG4gICAgZGVmaW5lKFsnZDMnXSwgZmFjdG9yeSlcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIC8vIENvbW1vbkpTXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkMykge1xuICAgICAgZDMudGlwID0gZmFjdG9yeShkMylcbiAgICAgIHJldHVybiBkMy50aXBcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWwuXG4gICAgcm9vdC5kMy50aXAgPSBmYWN0b3J5KHJvb3QuZDMpXG4gIH1cbn0odGhpcywgZnVuY3Rpb24gKGQzKSB7XG5cbiAgLy8gUHVibGljIC0gY29udHJ1Y3RzIGEgbmV3IHRvb2x0aXBcbiAgLy9cbiAgLy8gUmV0dXJucyBhIHRpcFxuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGRpcmVjdGlvbiA9IGQzX3RpcF9kaXJlY3Rpb24sXG4gICAgICAgIG9mZnNldCAgICA9IGQzX3RpcF9vZmZzZXQsXG4gICAgICAgIGh0bWwgICAgICA9IGQzX3RpcF9odG1sLFxuICAgICAgICBub2RlICAgICAgPSBpbml0Tm9kZSgpLFxuICAgICAgICBzdmcgICAgICAgPSBudWxsLFxuICAgICAgICBwb2ludCAgICAgPSBudWxsLFxuICAgICAgICB0YXJnZXQgICAgPSBudWxsXG5cbiAgICBmdW5jdGlvbiB0aXAodmlzKSB7XG4gICAgICBzdmcgPSBnZXRTVkdOb2RlKHZpcylcbiAgICAgIHBvaW50ID0gc3ZnLmNyZWF0ZVNWR1BvaW50KClcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSlcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgLSBzaG93IHRoZSB0b29sdGlwIG9uIHRoZSBzY3JlZW5cbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuc2hvdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICBpZihhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBTVkdFbGVtZW50KSB0YXJnZXQgPSBhcmdzLnBvcCgpXG5cbiAgICAgIHZhciBjb250ZW50ID0gaHRtbC5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBwb2Zmc2V0ID0gb2Zmc2V0LmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIGRpciAgICAgPSBkaXJlY3Rpb24uYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgbm9kZWwgICA9IGQzLnNlbGVjdChub2RlKSxcbiAgICAgICAgICBpICAgICAgID0gZGlyZWN0aW9ucy5sZW5ndGgsXG4gICAgICAgICAgY29vcmRzLFxuICAgICAgICAgIHNjcm9sbFRvcCAgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wLFxuICAgICAgICAgIHNjcm9sbExlZnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnRcblxuICAgICAgbm9kZWwuaHRtbChjb250ZW50KVxuICAgICAgICAuc3R5bGUoeyBvcGFjaXR5OiAxLCAncG9pbnRlci1ldmVudHMnOiAnYWxsJyB9KVxuXG4gICAgICB3aGlsZShpLS0pIG5vZGVsLmNsYXNzZWQoZGlyZWN0aW9uc1tpXSwgZmFsc2UpXG4gICAgICBjb29yZHMgPSBkaXJlY3Rpb25fY2FsbGJhY2tzLmdldChkaXIpLmFwcGx5KHRoaXMpXG4gICAgICBub2RlbC5jbGFzc2VkKGRpciwgdHJ1ZSkuc3R5bGUoe1xuICAgICAgICB0b3A6IChjb29yZHMudG9wICsgIHBvZmZzZXRbMF0pICsgc2Nyb2xsVG9wICsgJ3B4JyxcbiAgICAgICAgbGVmdDogKGNvb3Jkcy5sZWZ0ICsgcG9mZnNldFsxXSkgKyBzY3JvbGxMZWZ0ICsgJ3B4J1xuICAgICAgfSlcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIGhpZGUgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuaGlkZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG5vZGVsID0gZDMuc2VsZWN0KG5vZGUpXG4gICAgICBub2RlbC5zdHlsZSh7IG9wYWNpdHk6IDAsICdwb2ludGVyLWV2ZW50cyc6ICdub25lJyB9KVxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgYXR0ciBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgLy9cbiAgICAvLyBuIC0gbmFtZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGF0dHJpYnV0ZSB2YWx1ZVxuICAgIHRpcC5hdHRyID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZDMuc2VsZWN0KG5vZGUpLmF0dHIobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5hdHRyLmFwcGx5KGQzLnNlbGVjdChub2RlKSwgYXJncylcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgc3R5bGUgY2FsbHMgdG8gdGhlIGQzIHRpcCBjb250YWluZXIuICBTZXRzIG9yIGdldHMgYSBzdHlsZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vIHYgLSB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIHN0eWxlIHByb3BlcnR5IHZhbHVlXG4gICAgdGlwLnN0eWxlID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZDMuc2VsZWN0KG5vZGUpLnN0eWxlKG4pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYXJncyA9ICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUuc3R5bGUuYXBwbHkoZDMuc2VsZWN0KG5vZGUpLCBhcmdzKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBTZXQgb3IgZ2V0IHRoZSBkaXJlY3Rpb24gb2YgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBPbmUgb2Ygbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCBvciB3KHdlc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vICAgICBzdyhzb3V0aHdlc3QpLCBuZShub3J0aGVhc3QpIG9yIHNlKHNvdXRoZWFzdClcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGRpcmVjdGlvblxuICAgIHRpcC5kaXJlY3Rpb24gPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkaXJlY3Rpb25cbiAgICAgIGRpcmVjdGlvbiA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldHMgb3IgZ2V0cyB0aGUgb2Zmc2V0IG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBBcnJheSBvZiBbeCwgeV0gb2Zmc2V0XG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIG9mZnNldCBvclxuICAgIHRpcC5vZmZzZXQgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBvZmZzZXRcbiAgICAgIG9mZnNldCA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IHNldHMgb3IgZ2V0cyB0aGUgaHRtbCB2YWx1ZSBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIFN0cmluZyB2YWx1ZSBvZiB0aGUgdGlwXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGh0bWwgdmFsdWUgb3IgdGlwXG4gICAgdGlwLmh0bWwgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBodG1sXG4gICAgICBodG1sID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGQzX3RpcF9kaXJlY3Rpb24oKSB7IHJldHVybiAnbicgfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9vZmZzZXQoKSB7IHJldHVybiBbMCwgMF0gfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9odG1sKCkgeyByZXR1cm4gJyAnIH1cblxuICAgIHZhciBkaXJlY3Rpb25fY2FsbGJhY2tzID0gZDMubWFwKHtcbiAgICAgIG46ICBkaXJlY3Rpb25fbixcbiAgICAgIHM6ICBkaXJlY3Rpb25fcyxcbiAgICAgIGU6ICBkaXJlY3Rpb25fZSxcbiAgICAgIHc6ICBkaXJlY3Rpb25fdyxcbiAgICAgIG53OiBkaXJlY3Rpb25fbncsXG4gICAgICBuZTogZGlyZWN0aW9uX25lLFxuICAgICAgc3c6IGRpcmVjdGlvbl9zdyxcbiAgICAgIHNlOiBkaXJlY3Rpb25fc2VcbiAgICB9KSxcblxuICAgIGRpcmVjdGlvbnMgPSBkaXJlY3Rpb25fY2FsbGJhY2tzLmtleXMoKVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX24oKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5uLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uLnggLSBub2RlLm9mZnNldFdpZHRoIC8gMlxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gucy55LFxuICAgICAgICBsZWZ0OiBiYm94LnMueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX2UoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5lLnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC53LnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3gudy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9udygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm53LnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5udy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9uZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm5lLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3N3KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc3cueSxcbiAgICAgICAgbGVmdDogYmJveC5zdy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnNlLnksXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdE5vZGUoKSB7XG4gICAgICB2YXIgbm9kZSA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSlcbiAgICAgIG5vZGUuc3R5bGUoe1xuICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcbiAgICAgICAgdG9wOiAwLFxuICAgICAgICBvcGFjaXR5OiAwLFxuICAgICAgICAncG9pbnRlci1ldmVudHMnOiAnbm9uZScsXG4gICAgICAgICdib3gtc2l6aW5nJzogJ2JvcmRlci1ib3gnXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gbm9kZS5ub2RlKClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTVkdOb2RlKGVsKSB7XG4gICAgICBlbCA9IGVsLm5vZGUoKVxuICAgICAgaWYoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc3ZnJylcbiAgICAgICAgcmV0dXJuIGVsXG5cbiAgICAgIHJldHVybiBlbC5vd25lclNWR0VsZW1lbnRcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlIC0gZ2V0cyB0aGUgc2NyZWVuIGNvb3JkaW5hdGVzIG9mIGEgc2hhcGVcbiAgICAvL1xuICAgIC8vIEdpdmVuIGEgc2hhcGUgb24gdGhlIHNjcmVlbiwgd2lsbCByZXR1cm4gYW4gU1ZHUG9pbnQgZm9yIHRoZSBkaXJlY3Rpb25zXG4gICAgLy8gbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCB3KHdlc3QpLCBuZShub3J0aGVhc3QpLCBzZShzb3V0aGVhc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vIHN3KHNvdXRod2VzdCkuXG4gICAgLy9cbiAgICAvLyAgICArLSstK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKyAgICtcbiAgICAvLyAgICB8ICAgfFxuICAgIC8vICAgICstKy0rXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGFuIE9iamVjdCB7biwgcywgZSwgdywgbncsIHN3LCBuZSwgc2V9XG4gICAgZnVuY3Rpb24gZ2V0U2NyZWVuQkJveCgpIHtcbiAgICAgIHZhciB0YXJnZXRlbCAgID0gdGFyZ2V0IHx8IGQzLmV2ZW50LnRhcmdldDtcblxuICAgICAgd2hpbGUgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgdGFyZ2V0ZWwuZ2V0U2NyZWVuQ1RNICYmICd1bmRlZmluZWQnID09PSB0YXJnZXRlbC5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgdGFyZ2V0ZWwgPSB0YXJnZXRlbC5wYXJlbnROb2RlO1xuICAgICAgfVxuXG4gICAgICB2YXIgYmJveCAgICAgICA9IHt9LFxuICAgICAgICAgIG1hdHJpeCAgICAgPSB0YXJnZXRlbC5nZXRTY3JlZW5DVE0oKSxcbiAgICAgICAgICB0YmJveCAgICAgID0gdGFyZ2V0ZWwuZ2V0QkJveCgpLFxuICAgICAgICAgIHdpZHRoICAgICAgPSB0YmJveC53aWR0aCxcbiAgICAgICAgICBoZWlnaHQgICAgID0gdGJib3guaGVpZ2h0LFxuICAgICAgICAgIHggICAgICAgICAgPSB0YmJveC54LFxuICAgICAgICAgIHkgICAgICAgICAgPSB0YmJveC55XG5cbiAgICAgIHBvaW50LnggPSB4XG4gICAgICBwb2ludC55ID0geVxuICAgICAgYmJveC5udyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54ICs9IHdpZHRoXG4gICAgICBiYm94Lm5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgKz0gaGVpZ2h0XG4gICAgICBiYm94LnNlID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGhcbiAgICAgIGJib3guc3cgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94LncgID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3guZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54IC09IHdpZHRoIC8gMlxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94Lm4gPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3gucyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG5cbiAgICAgIHJldHVybiBiYm94XG4gICAgfVxuXG4gICAgcmV0dXJuIHRpcFxuICB9O1xuXG59KSk7XG4iLCIvKipcbiAqXG4gKiBNdXRhdGlvbnMgTmVlZGxlIFBsb3QgKG11dHMtbmVlZGxlLXBsb3QpXG4gKlxuICogQ3JlYXRlcyBhIG5lZWRsZSBwbG90IChhLmsuYSBzdGVtIHBsb3QsIGxvbGxpcG9wLXBsb3QgYW5kIHNvb24gYWxzbyBiYWxsb29uIHBsb3QgOy0pXG4gKiBUaGlzIGNsYXNzIHVzZXMgdGhlIG5wbS1yZXF1aXJlIG1vZHVsZSB0byBsb2FkIGRlcGVuZGVuY2llcyBkMywgZDMtdGlwXG4gKlxuICogQGF1dGhvciBNaWNoYWVsIFAgU2Nocm9lZGVyXG4gKiBAY2xhc3NcbiAqL1xuXG5mdW5jdGlvbiBNdXRzTmVlZGxlUGxvdCAoY29uZmlnKSB7XG5cbiAgICAvLyBJTklUSUFMSVpBVElPTlxuXG4gICAgdmFyIHNlbGYgPSB0aGlzOyAgICAgICAgLy8gc2VsZiA9IE11dHNOZWVkbGVQbG90XG5cbiAgICAvLyBYLWNvb3JkaW5hdGVzXG4gICAgdGhpcy5tYXhDb29yZCA9IGNvbmZpZy5tYXhDb29yZCB8fCAtMTsgICAgICAgICAgICAgLy8gVGhlIG1heGltdW0gY29vcmQgKHgtYXhpcylcbiAgICBpZiAodGhpcy5tYXhDb29yZCA8IDApIHsgdGhyb3cgbmV3IEVycm9yKFwiJ21heENvb3JkJyBtdXN0IGJlIGRlZmluZWQgaW5pdGlhdGlvbiBjb25maWchXCIpOyB9XG4gICAgdGhpcy5taW5Db29yZCA9IGNvbmZpZy5taW5Db29yZCB8fCAxOyAgICAgICAgICAgICAgIC8vIFRoZSBtaW5pbXVtIGNvb3JkICh4LWF4aXMpXG5cbiAgICAvLyBkYXRhXG4gICAgdmFyIG11dGF0aW9uRGF0YSA9IGNvbmZpZy5tdXRhdGlvbkRhdGEgfHwgLTE7ICAgICAgICAgIC8vIC5qc29uIGZpbGUgb3IgZGljdFxuICAgIGlmICh0aGlzLm1heENvb3JkIDwgMCkgeyB0aHJvdyBuZXcgRXJyb3IoXCInbXV0YXRpb25EYXRhJyBtdXN0IGJlIGRlZmluZWQgaW5pdGlhdGlvbiBjb25maWchXCIpOyB9XG4gICAgdmFyIHJlZ2lvbkRhdGEgPSBjb25maWcucmVnaW9uRGF0YSB8fCAtMTsgICAgICAgICAgICAgIC8vIC5qc29uIGZpbGUgb3IgZGljdFxuICAgIGlmICh0aGlzLm1heENvb3JkIDwgMCkgeyB0aHJvdyBuZXcgRXJyb3IoXCIncmVnaW9uRGF0YScgbXVzdCBiZSBkZWZpbmVkIGluaXRpYXRpb24gY29uZmlnIVwiKTsgfVxuICAgIHRoaXMudG90YWxDYXRlZ0NvdW50cyA9IHt9O1xuICAgIHRoaXMuY2F0ZWdDb3VudHMgPSB7fTtcbiAgICB0aGlzLnNlbGVjdGVkTmVlZGxlcyA9IFtdO1xuXG4gICAgLy8gUGxvdCBkaW1lbnNpb25zICYgdGFyZ2V0XG4gICAgdmFyIHRhcmdldEVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcudGFyZ2V0RWxlbWVudCkgfHwgY29uZmlnLnRhcmdldEVsZW1lbnQgfHwgZG9jdW1lbnQuYm9keSAgIC8vIFdoZXJlIHRvIGFwcGVuZCB0aGUgcGxvdCAoc3ZnKVxuXG4gICAgdmFyIHdpZHRoID0gdGhpcy53aWR0aCA9IGNvbmZpZy53aWR0aCB8fCB0YXJnZXRFbGVtZW50Lm9mZnNldFdpZHRoIHx8IDEwMDA7XG4gICAgdmFyIGhlaWdodCA9IHRoaXMuaGVpZ2h0ID0gY29uZmlnLmhlaWdodCB8fCB0YXJnZXRFbGVtZW50Lm9mZnNldEhlaWdodCB8fCA1MDA7XG5cbiAgICAvLyBDb2xvciBzY2FsZSAmIG1hcFxuICAgIHRoaXMuY29sb3JNYXAgPSBjb25maWcuY29sb3JNYXAgfHwge307ICAgICAgICAgICAgICAvLyBkaWN0XG4gICAgdmFyIGNvbG9ycyA9IE9iamVjdC5rZXlzKHRoaXMuY29sb3JNYXApLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBzZWxmLmNvbG9yTWFwW2tleV07XG4gICAgfSk7XG4gICAgdGhpcy5jb2xvclNjYWxlID0gZDMuc2NhbGUuY2F0ZWdvcnkyMCgpXG4gICAgICAgIC5kb21haW4oT2JqZWN0LmtleXModGhpcy5jb2xvck1hcCkpXG4gICAgICAgIC5yYW5nZShjb2xvcnMuY29uY2F0KGQzLnNjYWxlLmNhdGVnb3J5MjAoKS5yYW5nZSgpKSk7XG4gICAgdGhpcy5sZWdlbmRzID0gY29uZmlnLmxlZ2VuZHMgfHwge1xuICAgICAgICBcInlcIjogXCJWYWx1ZVwiLFxuICAgICAgICBcInhcIjogXCJDb29yZGluYXRlXCJcbiAgICB9O1xuXG4gICAgdGhpcy5zdmdDbGFzc2VzID0gXCJtdXRuZWVkbGVzXCI7XG4gICAgdGhpcy5idWZmZXIgPSAwO1xuXG4gICAgdmFyIG1heENvb3JkID0gdGhpcy5tYXhDb29yZDtcblxuICAgIHZhciBidWZmZXIgPSAwO1xuICAgIGlmICh3aWR0aCA+PSBoZWlnaHQpIHtcbiAgICAgIGJ1ZmZlciA9IGhlaWdodCAvIDg7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciA9IHdpZHRoIC8gODtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcblxuICAgIC8vIElJTVBPUlQgQU5EIENPTkZJR1VSRSBUSVBTXG4gICAgdmFyIGQzdGlwID0gcmVxdWlyZSgnZDMtdGlwJyk7XG4gICAgZDN0aXAoZDMpO1xuXG5cbiAgICB0aGlzLnRpcCA9IGQzLnRpcCgpXG4gICAgICAuYXR0cignY2xhc3MnLCAnbXV0cy1uZWVkbGUtcGxvdCBkMy10aXAgZDMtdGlwLW5lZWRsZScpXG4gICAgICAub2Zmc2V0KFstMTAsIDBdKVxuICAgICAgLmh0bWwoZnVuY3Rpb24oZCkge1xuICAgICAgICByZXR1cm4gXCI8c3Bhbj5cIiArIGQudmFsdWUgKyBcIiBcIiArIGQuY2F0ZWdvcnkgKyAgXCIgYXQgY29vcmQuIFwiICsgZC5jb29yZFN0cmluZyArIFwiPC9zcGFuPlwiO1xuICAgICAgfSk7XG5cbiAgICB0aGlzLnNlbGVjdGlvblRpcCA9IGQzLnRpcCgpXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdtdXRzLW5lZWRsZS1wbG90IGQzLXRpcCBkMy10aXAtc2VsZWN0aW9uJylcbiAgICAgICAgLm9mZnNldChbLTUwLCAwXSlcbiAgICAgICAgLmh0bWwoZnVuY3Rpb24oZCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiPHNwYW4+IFNlbGVjdGVkIGNvb3JkaW5hdGVzPGJyLz5cIiArIE1hdGgucm91bmQoZC5sZWZ0KSArIFwiIC0gXCIgKyBNYXRoLnJvdW5kKGQucmlnaHQpICsgXCI8L3NwYW4+XCI7XG4gICAgICAgIH0pXG4gICAgICAgIC5kaXJlY3Rpb24oJ24nKTtcblxuICAgIC8vIElOSVQgU1ZHXG4gICAgdmFyIHN2ZztcbiAgICB2YXIgdG9wbm9kZTtcbiAgICBpZiAoY29uZmlnLnJlc3BvbnNpdmUgPT0gJ3Jlc2l6ZScpIHtcbiAgICAgICAgdG9wbm9kZSAgPSBkMy5zZWxlY3QodGFyZ2V0RWxlbWVudCkuYXBwZW5kKFwic3ZnXCIpXG4gICAgICAgICAgICAuYXR0cihcIndpZHRoXCIsICcxMDAlJylcbiAgICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsICcxMDAlJylcbiAgICAgICAgICAgIC5hdHRyKCd2aWV3Qm94JywnMCAwICcrTWF0aC5taW4od2lkdGgpKycgJytNYXRoLm1pbihoZWlnaHQpKVxuICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2JydXNoJyk7XG4gICAgICAgIHN2ZyA9IHRvcG5vZGVcbiAgICAgICAgICAgIC5hcHBlbmQoXCJnXCIpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIHRoaXMuc3ZnQ2xhc3NlcylcbiAgICAgICAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsMClcIik7XG4gICAgfSBlbHNlICB7XG5cbiAgICAgICAgc3ZnID0gZDMuc2VsZWN0KHRhcmdldEVsZW1lbnQpLmFwcGVuZChcInN2Z1wiKVxuICAgICAgICAgICAgLmF0dHIoXCJ3aWR0aFwiLCB3aWR0aClcbiAgICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIGhlaWdodClcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgdGhpcy5zdmdDbGFzc2VzICsgXCIgYnJ1c2hcIik7XG4gICAgICAgIHRvcG5vZGUgPSBzdmc7XG4gICAgfVxuXG5cbiAgICBzdmcuY2FsbCh0aGlzLnRpcCk7XG4gICAgc3ZnLmNhbGwodGhpcy5zZWxlY3Rpb25UaXApO1xuXG4gICAgLy8gREVGSU5FIFNDQUxFU1xuXG4gICAgdmFyIHggPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgLmRvbWFpbihbdGhpcy5taW5Db29yZCwgdGhpcy5tYXhDb29yZF0pXG4gICAgICAucmFuZ2UoW2J1ZmZlciAqIDEuNSAsIHdpZHRoIC0gYnVmZmVyXSlcbiAgICAgIC5uaWNlKCk7XG4gICAgdGhpcy54ID0geDtcblxuICAgIHZhciB5ID0gZDMuc2NhbGUubGluZWFyKClcbiAgICAgIC5kb21haW4oWzEsMjBdKVxuICAgICAgLnJhbmdlKFtoZWlnaHQgLSBidWZmZXIgKiAxLjUsIGJ1ZmZlcl0pXG4gICAgICAubmljZSgpO1xuICAgIHRoaXMueSA9IHk7XG5cbiAgICAvLyBDT05GSUdVUkUgQlJVU0hcbiAgICBzZWxmLnNlbGVjdG9yID0gZDMuc3ZnLmJydXNoKClcbiAgICAgICAgLngoeClcbiAgICAgICAgLm9uKFwiYnJ1c2hcIiwgYnJ1c2htb3ZlKVxuICAgICAgICAub24oXCJicnVzaGVuZFwiLCBicnVzaGVuZCk7XG4gICAgdmFyIHNlbGVjdG9yID0gc2VsZi5zZWxlY3RvcjtcblxuICAgIHZhciBzZWxlY3Rpb25SZWN0ID0gdG9wbm9kZVxuICAgICAgICAuY2FsbChzZWxlY3RvcilcbiAgICAgICAgLnNlbGVjdEFsbCgnLmV4dGVudCcpXG4gICAgICAgIC5hdHRyKCdoZWlnaHQnLCA1MClcbiAgICAgICAgLmF0dHIoJ3knLCBoZWlnaHQtNTApXG4gICAgICAgIC5hdHRyKCdvcGFjaXR5JywgMC4yKTtcblxuICAgIHNlbGVjdGlvblJlY3Qub24oXCJtb3VzZWVudGVyXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc2VsZWN0aW9uID0gc2VsZWN0b3IuZXh0ZW50KCk7XG4gICAgICAgIHNlbGYuc2VsZWN0aW9uVGlwLnNob3coe2xlZnQ6IHNlbGVjdGlvblswXSwgcmlnaHQ6IHNlbGVjdGlvblsxXX0sIHNlbGVjdGlvblJlY3Qubm9kZSgpKTtcbiAgICB9KVxuICAgICAgICAub24oXCJtb3VzZW91dFwiLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgLy9kMy5zZWxlY3QoXCIuZDMtdGlwLXNlbGVjdGlvblwiKVxuICAgICAgICAgICAgc2VsZi5zZWxlY3Rpb25UaXBcbiAgICAgICAgICAgICAgICAvLy50cmFuc2l0aW9uKClcbiAgICAgICAgICAgICAgICAvLy5kZWxheSgzMDAwKVxuICAgICAgICAgICAgICAgIC8vLmR1cmF0aW9uKDEwMDApXG4gICAgICAgICAgICAgICAgLnN0eWxlKFwib3BhY2l0eVwiLDApXG4gICAgICAgICAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdub25lJyk7XG4gICAgICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gc2VsZWN0aW9uRGV0YWlscygpIHtcbiAgICAgICAgdmFyIGV4dGVudCA9IHNlbGVjdG9yLmV4dGVudCgpO1xuICAgICAgICB2YXIgbmVlZGxlSGVhZHMgPSBzdmcuc2VsZWN0QWxsKFwiLm5lZWRsZS1oZWFkXCIpO1xuICAgICAgICB2YXIgc2VsZWN0ZWROZWVkbGVzID0gW107XG4gICAgICAgIHZhciBjYXRlZ0NvdW50cyA9IHt9O1xuICAgICAgICBmb3IgKGtleSBpbiBPYmplY3Qua2V5cyhzZWxmLnRvdGFsQ2F0ZWdDb3VudHMpKSB7XG4gICAgICAgICAgICBjYXRlZ0NvdW50c1trZXldID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIG5lZWRsZUhlYWRzLmNsYXNzZWQoXCJzZWxlY3RlZFwiLCBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICBpc19icnVzaGVkID0gZXh0ZW50WzBdIDw9IGQuY29vcmQgJiYgZC5jb29yZCA8PSBleHRlbnRbMV07XG4gICAgICAgICAgICBpZiAoaXNfYnJ1c2hlZCkge1xuICAgICAgICAgICAgICAgIHNlbGVjdGVkTmVlZGxlcy5wdXNoKGQpO1xuICAgICAgICAgICAgICAgIGNhdGVnQ291bnRzW2QuY2F0ZWdvcnldID0gKGNhdGVnQ291bnRzW2QuY2F0ZWdvcnldIHx8IDApICsgZC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpc19icnVzaGVkO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc2VsZWN0ZWQ6IHNlbGVjdGVkTmVlZGxlcyxcbiAgICAgICAgICAgIGNhdGVnQ291bnRzOiBjYXRlZ0NvdW50cyxcbiAgICAgICAgICAgIGNvb3JkczogZXh0ZW50LFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnJ1c2htb3ZlKCkge1xuICAgICAgICBzZWxmLnRyaWdnZXIoJ25lZWRsZVNlbGVjdGlvbkNoYW5nZScsXG4gICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb25EZXRhaWxzKCkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJydXNoZW5kKCkge1xuICAgICAgICAvL2dldF9idXR0b24gPSBkMy5zZWxlY3QoXCIuY2xlYXItYnV0dG9uXCIpO1xuICAgICAgICBzZWxmLnRyaWdnZXIoJ25lZWRsZVNlbGVjdGlvbkNoYW5nZUVuZCcsXG4gICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb25EZXRhaWxzKCkpO1xuICAgIH1cblxuICAgIC8vLyBEUkFXXG4gICAgdGhpcy5kcmF3TmVlZGxlcyhzdmcsIG11dGF0aW9uRGF0YSwgcmVnaW9uRGF0YSk7XG5cblxuICAgIHNlbGYub24oXCJuZWVkbGVTZWxlY3Rpb25DaGFuZ2VcIiwgZnVuY3Rpb24gKGVkYXRhKSB7XG4gICAgICAgIHNlbGYuY2F0ZWdDb3VudHMgPSBlZGF0YS5jYXRlZ0NvdW50cztcbiAgICAgICAgc2VsZi5zZWxlY3RlZE5lZWRsZXMgPSBlZGF0YS5zZWxlY3RlZDtcbiAgICAgICAgc3ZnLmNhbGwoc2VsZi52ZXJ0aWNhbExlZ2VuZCk7XG4gICAgfSk7XG5cbiAgICBzZWxmLm9uKFwibmVlZGxlU2VsZWN0aW9uQ2hhbmdlRW5kXCIsIGZ1bmN0aW9uIChlZGF0YSkge1xuICAgICAgICBzZWxmLmNhdGVnQ291bnRzID0gZWRhdGEuY2F0ZWdDb3VudHM7XG4gICAgICAgIHNlbGYuc2VsZWN0ZWROZWVkbGVzID0gZWRhdGEuc2VsZWN0ZWQ7XG4gICAgICAgIHN2Zy5jYWxsKHNlbGYudmVydGljYWxMZWdlbmQpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5vbihcIm5lZWRsZVNlbGVjdGlvbkNoYW5nZVwiLCBmdW5jdGlvbihlZGF0YSkge1xuICAgICAgICB2YXIgc2VsZWN0aW9uID0gZWRhdGEuY29vcmRzO1xuICAgICAgICBpZiAoc2VsZWN0aW9uWzFdIC0gc2VsZWN0aW9uWzBdID4gMCkge1xuICAgICAgICAgICAgc2VsZi5zZWxlY3Rpb25UaXAuc2hvdyh7bGVmdDogc2VsZWN0aW9uWzBdLCByaWdodDogc2VsZWN0aW9uWzFdfSwgc2VsZWN0aW9uUmVjdC5ub2RlKCkpO1xuICAgICAgICAgICAgLy9kMy5zZWxlY3QoXCIuZDMtdGlwLXNlbGVjdGlvblwiKVxuICAgICAgICAgICAgc2VsZi5zZWxlY3Rpb25UaXBcbiAgICAgICAgICAgICAgICAvLy50cmFuc2l0aW9uKClcbiAgICAgICAgICAgICAgICAvLy5kZWxheSgzMDAwKVxuICAgICAgICAgICAgICAgIC8vLmFkdXJhdGlvbigxMDAwKVxuICAgICAgICAgICAgICAgIC5zdHlsZShcIm9wYWNpdHlcIiwwKVxuICAgICAgICAgICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5zZWxlY3Rpb25UaXAuaGlkZSgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbn1cblxuTXV0c05lZWRsZVBsb3QucHJvdG90eXBlLmRyYXdMZWdlbmQgPSBmdW5jdGlvbihzdmcpIHtcblxuICAgIC8vIExFR0VORFxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIHByZXBhcmUgbGVnZW5kIGNhdGVnb3JpZXMgKGNvcnJlY3Qgb3JkZXIpXG4gICAgdmFyIG11dENhdGVnb3JpZXMgPSBbXTtcbiAgICB2YXIgY2F0ZWdvcnlDb2xvcnMgPSBbXTtcbiAgICB2YXIgYWxsY2F0ZWdzID0gT2JqZWN0LmtleXMoc2VsZi50b3RhbENhdGVnQ291bnRzKTsgLy8gcmFuZG9tIG9yZGVyXG4gICAgdmFyIG9yZGVyZWREZWNsYXJhdGlvbiA9IHNlbGYuY29sb3JTY2FsZS5kb21haW4oKTsgIC8vIHdhbnRlZCBvcmRlclxuICAgIHZhciBpZHhcbiAgICBmb3IgKGlkeCBpbiBvcmRlcmVkRGVjbGFyYXRpb24pIHtcbiAgICAgICAgdmFyIGMgPSBvcmRlcmVkRGVjbGFyYXRpb25baWR4XTtcbiAgICAgICAgaWYgKGFsbGNhdGVncy5pbmRleE9mKGMpID4gLTEpIHtcbiAgICAgICAgICAgIG11dENhdGVnb3JpZXMucHVzaChjKTtcbiAgICAgICAgICAgIGNhdGVnb3J5Q29sb3JzLnB1c2goc2VsZi5jb2xvclNjYWxlKGMpKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHNjYWxlIHdpdGggY29ycmVjdCBvcmRlciBvZiBjYXRlZ29yaWVzXG4gICAgdmFyIG11dHNTY2FsZSA9IHNlbGYuY29sb3JTY2FsZS5kb21haW4obXV0Q2F0ZWdvcmllcykucmFuZ2UoY2F0ZWdvcnlDb2xvcnMpO1xuXG5cbiAgICB2YXIgZG9tYWluID0gc2VsZi54LmRvbWFpbigpO1xuICAgIHZhciB4cGxhY2VtZW50ID0gKHNlbGYueChkb21haW5bMV0pIC0gc2VsZi54KGRvbWFpblswXSkpICogMC43NSArIHNlbGYueChkb21haW5bMF0pO1xuXG5cbiAgICB2YXIgc3VtID0gMDtcbiAgICBmb3IgKHZhciBjIGluIHNlbGYudG90YWxDYXRlZ0NvdW50cykge1xuICAgICAgICBzdW0gKz0gc2VsZi50b3RhbENhdGVnQ291bnRzW2NdO1xuICAgIH1cblxuICAgIHZhciBsZWdlbmRMYWJlbCA9IGZ1bmN0aW9uKGNhdGVnKSB7XG4gICAgICAgIHZhciBjb3VudCA9IChzZWxmLmNhdGVnQ291bnRzW2NhdGVnXSB8fCAoc2VsZi5zZWxlY3RlZE5lZWRsZXMubGVuZ3RoID09IDAgJiYgc2VsZi50b3RhbENhdGVnQ291bnRzW2NhdGVnXSkgfHwgMCk7XG4gICAgICAgIHJldHVybiBjYXRlZyArIChjb3VudCA+IDAgPyBcIjogXCIrY291bnQrXCIgKFwiICsgTWF0aC5yb3VuZChjb3VudC9zdW0qMTAwKSArIFwiJSlcIiA6IFwiXCIpO1xuICAgIH07XG5cbiAgICB2YXIgbGVnZW5kQ2xhc3MgPSBmdW5jdGlvbihjYXRlZykge1xuICAgICAgICB2YXIgY291bnQgPSAoc2VsZi5jYXRlZ0NvdW50c1tjYXRlZ10gfHwgKHNlbGYuc2VsZWN0ZWROZWVkbGVzLmxlbmd0aCA9PSAwICYmIHNlbGYudG90YWxDYXRlZ0NvdW50c1tjYXRlZ10pIHx8IDApO1xuICAgICAgICByZXR1cm4gKGNvdW50ID4gMCkgPyBcIlwiIDogXCJub211dHNcIjtcbiAgICB9O1xuXG4gICAgc2VsZi5ub3Nob3cgPSBbXTtcbiAgICB2YXIgbmVlZGxlSGVhZHMgPSBzdmcuc2VsZWN0QWxsKFwiLm5lZWRsZS1oZWFkXCIpO1xuICAgIHZhciBzaG93Tm9TaG93ID0gZnVuY3Rpb24oY2F0ZWcpe1xuICAgICAgICBpZiAoXy5jb250YWlucyhzZWxmLm5vc2hvdywgY2F0ZWcpKSB7XG4gICAgICAgICAgICBzZWxmLm5vc2hvdyA9IF8uZmlsdGVyKHNlbGYubm9zaG93LCBmdW5jdGlvbihzKSB7IHJldHVybiBzICE9IGNhdGVnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5ub3Nob3cucHVzaChjYXRlZyk7XG4gICAgICAgIH1cbiAgICAgICAgbmVlZGxlSGVhZHMuY2xhc3NlZChcIm5vc2hvd1wiLCBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICByZXR1cm4gXy5jb250YWlucyhzZWxmLm5vc2hvdywgZC5jYXRlZ29yeSk7XG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgbGVnZW5kQ2VsbHMgPSBzdmcuc2VsZWN0QWxsKFwiZy5sZWdlbmRDZWxsc1wiKTtcbiAgICAgICAgbGVnZW5kQ2VsbHMuY2xhc3NlZChcIm5vc2hvd1wiLCBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICByZXR1cm4gXy5jb250YWlucyhzZWxmLm5vc2hvdywgZC5zdG9wWzBdKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuXG4gICAgdmFyIHZlcnRpY2FsTGVnZW5kID0gZDMuc3ZnLmxlZ2VuZCgpXG4gICAgICAgIC5sYWJlbEZvcm1hdChsZWdlbmRMYWJlbClcbiAgICAgICAgLmxhYmVsQ2xhc3MobGVnZW5kQ2xhc3MpXG4gICAgICAgIC5vbkxlZ2VuZENsaWNrKHNob3dOb1Nob3cpXG4gICAgICAgIC5jZWxsUGFkZGluZyg0KVxuICAgICAgICAub3JpZW50YXRpb24oXCJ2ZXJ0aWNhbFwiKVxuICAgICAgICAudW5pdHMoc3VtICsgXCIgTXV0YXRpb25zXCIpXG4gICAgICAgIC5jZWxsV2lkdGgoMjApXG4gICAgICAgIC5jZWxsSGVpZ2h0KDEyKVxuICAgICAgICAuaW5wdXRTY2FsZShtdXRzU2NhbGUpXG4gICAgICAgIC5jZWxsU3RlcHBpbmcoNClcbiAgICAgICAgLnBsYWNlKHt4OiB4cGxhY2VtZW50LCB5OiA1MH0pO1xuXG4gICAgc2VsZi52ZXJ0aWNhbExlZ2VuZCA9IHZlcnRpY2FsTGVnZW5kXG5cbiAgICBzdmcuY2FsbCh2ZXJ0aWNhbExlZ2VuZCk7XG5cbn07XG5cbk11dHNOZWVkbGVQbG90LnByb3RvdHlwZS5kcmF3UmVnaW9ucyA9IGZ1bmN0aW9uKHN2ZywgcmVnaW9uRGF0YSkge1xuXG4gICAgdmFyIG1heENvb3JkID0gdGhpcy5tYXhDb29yZDtcbiAgICB2YXIgbWluQ29vcmQgPSB0aGlzLm1pbkNvb3JkO1xuICAgIHZhciBidWZmZXIgPSB0aGlzLmJ1ZmZlcjtcbiAgICB2YXIgY29sb3JzID0gdGhpcy5jb2xvck1hcDtcbiAgICB2YXIgeSA9IHRoaXMueTtcbiAgICB2YXIgeCA9IHRoaXMueDtcblxuICAgIHZhciBiZWxvdyA9IHRydWU7XG5cblxuICAgIGdldFJlZ2lvblN0YXJ0ID0gZnVuY3Rpb24ocmVnaW9uKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUludChyZWdpb24uc3BsaXQoXCItXCIpWzBdKVxuICAgIH07XG5cbiAgICBnZXRSZWdpb25FbmQgPSBmdW5jdGlvbihyZWdpb24pIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KHJlZ2lvbi5zcGxpdChcIi1cIilbMV0pXG4gICAgfTtcblxuICAgIGdldENvbG9yID0gdGhpcy5jb2xvclNjYWxlO1xuXG4gICAgdmFyIGJnX29mZnNldCA9IDA7XG4gICAgdmFyIHJlZ2lvbl9vZmZzZXQgPSBiZ19vZmZzZXQtM1xuICAgIHZhciB0ZXh0X29mZnNldCA9IGJnX29mZnNldCArIDIwO1xuICAgIGlmIChiZWxvdyAhPSB0cnVlKSB7XG4gICAgICAgIHRleHRfb2Zmc2V0ID0gYmdfb2Zmc2V0KzU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZHJhdyhyZWdpb25MaXN0KSB7XG5cbiAgICAgICAgdmFyIHJlZ2lvbnNCRyA9IHN2Zy5zZWxlY3RBbGwoKSAvLyBkMy5zZWxlY3QoXCIubXV0bmVlZGxlc1wiKS5zZWxlY3RBbGwoKVxuICAgICAgICAgICAgLmRhdGEoW1wiZHVtbXlcIl0pLmVudGVyKClcbiAgICAgICAgICAgIC5pbnNlcnQoXCJnXCIsIFwiOmZpcnN0LWNoaWxkXCIpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwicmVnaW9uc0JHXCIpXG4gICAgICAgICAgICAuYXBwZW5kKFwicmVjdFwiKVxuICAgICAgICAgICAgLmF0dHIoXCJ4XCIsIHgobWluQ29vcmQpIClcbiAgICAgICAgICAgIC5hdHRyKFwieVwiLCB5KDApICsgYmdfb2Zmc2V0IClcbiAgICAgICAgICAgIC5hdHRyKFwid2lkdGhcIiwgeChtYXhDb29yZCkgLSB4KG1pbkNvb3JkKSApXG4gICAgICAgICAgICAuYXR0cihcImhlaWdodFwiLCAxMClcbiAgICAgICAgICAgIC5hdHRyKFwiZmlsbFwiLCBcImxpZ2h0Z3JleVwiKTtcblxuXG4gICAgICAgIHN2Zy5zZWxlY3QoXCIuZXh0ZW50XCIpIC8vIGQzLnNlbGVjdChcIi5leHRlbnRcIilcbiAgICAgICAgICAgIC5hdHRyKFwieVwiLCB5KDApICsgcmVnaW9uX29mZnNldCAtIDEwKTtcblxuXG4gICAgICAgIHZhciByZWdpb25zID0gcmVnaW9uc0JHID0gc3ZnLnNlbGVjdEFsbCgpIC8vIGQzLnNlbGVjdChcIi5tdXRuZWVkbGVzXCIpLnNlbGVjdEFsbCgpXG4gICAgICAgICAgICAuZGF0YShyZWdpb25MaXN0KVxuICAgICAgICAgICAgLmVudGVyKClcbiAgICAgICAgICAgIC5hcHBlbmQoXCJnXCIpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwicmVnaW9uR3JvdXBcIik7XG5cbiAgICAgICAgcmVnaW9ucy5hcHBlbmQoXCJyZWN0XCIpXG4gICAgICAgICAgICAuYXR0cihcInhcIiwgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geChyLnN0YXJ0KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuYXR0cihcInlcIiwgeSgwKSArIHJlZ2lvbl9vZmZzZXQgKVxuICAgICAgICAgICAgLmF0dHIoXCJyeVwiLCBcIjNcIilcbiAgICAgICAgICAgIC5hdHRyKFwicnhcIiwgXCIzXCIpXG4gICAgICAgICAgICAuYXR0cihcIndpZHRoXCIsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgoci5lbmQpIC0geChyLnN0YXJ0KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIDE2KVxuICAgICAgICAgICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhLmNvbG9yXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnN0eWxlKFwic3Ryb2tlXCIsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGQzLnJnYihkYXRhLmNvbG9yKS5kYXJrZXIoKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmVnaW9uc1xuICAgICAgICAgICAgLmF0dHIoJ3BvaW50ZXItZXZlbnRzJywgJ2FsbCcpXG4gICAgICAgICAgICAuYXR0cignY3Vyc29yJywgJ3BvaW50ZXInKVxuICAgICAgICAgICAgLm9uKFwiY2xpY2tcIiwgIGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICAgIC8vIHNldCBjdXN0b20gc2VsZWN0aW9uIGV4dGVudFxuICAgICAgICAgICAgc2VsZi5zZWxlY3Rvci5leHRlbnQoW3Iuc3RhcnQsIHIuZW5kXSk7XG4gICAgICAgICAgICAvLyBjYWxsIHRoZSBleHRlbnQgdG8gY2hhbmdlIHdpdGggdHJhbnNpdGlvblxuICAgICAgICAgICAgLy9zZWxmLnNlbGVjdG9yKGQzLnNlbGVjdChcIi5icnVzaFwiKS50cmFuc2l0aW9uKCkpO1xuICAgICAgICAgICAgc2VsZi5zZWxlY3RvcihzdmcudHJhbnNpdGlvbigpKTsgLy8gc3ZnIGFsd2F5cyBoYXMgY2xhc3MgJ2JydXNoJz9cbiAgICAgICAgICAgIC8vIGNhbGwgZXh0ZW50IChzZWxlY3Rpb24pIGNoYW5nZSBsaXN0ZW5lcnNcbiAgICAgICAgICAgIC8vc2VsZi5zZWxlY3Rvci5ldmVudChkMy5zZWxlY3QoXCIuYnJ1c2hcIikudHJhbnNpdGlvbigpLmRlbGF5KDMwMCkpO1xuICAgICAgICAgICAgc2VsZi5zZWxlY3RvcihzdmcudHJhbnNpdGlvbigpLmRlbGF5KDMwMCkpOyAvLyBzdmcgYWx3YXlzIGhhcyBjbGFzcyAnYnJ1c2gnP1xuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBsYWNlIGFuZCBsYWJlbCBsb2NhdGlvblxuICAgICAgICB2YXIgbGFiZWxzID0gW107XG5cbiAgICAgICAgdmFyIHJlcGVhdGVkUmVnaW9uID0ge307XG4gICAgICAgIHZhciBnZXRSZWdpb25DbGFzcyA9IGZ1bmN0aW9uKHJlZ2lvbikge1xuICAgICAgICAgICAgdmFyIGMgPSBcInJlZ2lvbk5hbWVcIjtcbiAgICAgICAgICAgIHZhciByZXBlYXRlZENsYXNzID0gXCJSUl9cIityZWdpb24ubmFtZTtcbiAgICAgICAgICAgIGlmKF8uaGFzKHJlcGVhdGVkUmVnaW9uLCByZWdpb24ubmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjID0gXCJyZXBlYXRlZE5hbWUgbm9zaG93IFwiICsgcmVwZWF0ZWRDbGFzcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcGVhdGVkUmVnaW9uW3JlZ2lvbi5uYW1lXSA9IHJlcGVhdGVkQ2xhc3M7XG4gICAgICAgICAgICByZXR1cm4gYztcbiAgICAgICAgfTtcbiAgICAgICAgcmVnaW9ucy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIGdldFJlZ2lvbkNsYXNzKVxuICAgICAgICAgICAgLmF0dHIoXCJ0ZXh0LWFuY2hvclwiLCBcIm1pZGRsZVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJmaWxsXCIsIFwiYmxhY2tcIilcbiAgICAgICAgICAgIC5hdHRyKFwib3BhY2l0eVwiLCAwLjUpXG4gICAgICAgICAgICAuYXR0cihcInhcIiwgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICByLnggPSB4KHIuc3RhcnQpICsgKHgoci5lbmQpIC0geChyLnN0YXJ0KSkgLyAyO1xuICAgICAgICAgICAgICAgIHJldHVybiByLng7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmF0dHIoXCJ5XCIsIGZ1bmN0aW9uKHIpIHtyLnkgPSB5KDApICsgdGV4dF9vZmZzZXQ7IHJldHVybiByLnk7IH0gKVxuICAgICAgICAgICAgLmF0dHIoXCJkeVwiLCBcIjAuMzVlbVwiKVxuICAgICAgICAgICAgLnN0eWxlKFwiZm9udC1zaXplXCIsIFwiMTJweFwiKVxuICAgICAgICAgICAgLnN0eWxlKFwidGV4dC1kZWNvcmF0aW9uXCIsIFwiYm9sZFwiKVxuICAgICAgICAgICAgLnRleHQoZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YS5uYW1lXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB2YXIgcmVnaW9uTmFtZXMgPSBzdmcuc2VsZWN0QWxsKFwiLnJlZ2lvbk5hbWVcIik7IC8vIGQzLnNlbGVjdEFsbChcIi5yZWdpb25OYW1lXCIpO1xuICAgICAgICByZWdpb25OYW1lcy5lYWNoKGZ1bmN0aW9uKGQsIGkpIHtcbiAgICAgICAgICAgIHZhciBpbnRlcmFjdGlvbkxlbmd0aCA9IHRoaXMuZ2V0QkJveCgpLndpZHRoIC8gMjtcbiAgICAgICAgICAgIGxhYmVscy5wdXNoKHt4OiBkLngsIHk6IGQueSwgbGFiZWw6IGQubmFtZSwgd2VpZ2h0OiBkLm5hbWUubGVuZ3RoLCByYWRpdXM6IGludGVyYWN0aW9uTGVuZ3RofSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBmb3JjZSA9IGQzLmxheW91dC5mb3JjZSgpXG4gICAgICAgICAgICAuY2hhcmdlRGlzdGFuY2UoNSlcbiAgICAgICAgICAgIC5ub2RlcyhsYWJlbHMpXG4gICAgICAgICAgICAuY2hhcmdlKC0xMClcbiAgICAgICAgICAgIC5ncmF2aXR5KDApO1xuXG4gICAgICAgIHZhciBtaW5YID0geChtaW5Db29yZCk7XG4gICAgICAgIHZhciBtYXhYID0geChtYXhDb29yZCk7XG4gICAgICAgIHZhciB3aXRoaW5Cb3VuZHMgPSBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gZDMubWluKFtcbiAgICAgICAgICAgICAgICBkMy5tYXgoW1xuICAgICAgICAgICAgICAgICAgICBtaW5YLFxuICAgICAgICAgICAgICAgICAgICB4XSksXG4gICAgICAgICAgICAgICAgbWF4WFxuICAgICAgICAgICAgXSk7XG4gICAgICAgIH07XG4gICAgICAgIGZ1bmN0aW9uIGNvbGxpZGUobm9kZSkge1xuICAgICAgICAgICAgdmFyIHIgPSBub2RlLnJhZGl1cyArIDMsXG4gICAgICAgICAgICAgICAgbngxID0gbm9kZS54IC0gcixcbiAgICAgICAgICAgICAgICBueDIgPSBub2RlLnggKyByLFxuICAgICAgICAgICAgICAgIG55MSA9IG5vZGUueSAtIHIsXG4gICAgICAgICAgICAgICAgbnkyID0gbm9kZS55ICsgcjtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihxdWFkLCB4MSwgeTEsIHgyLCB5Mikge1xuICAgICAgICAgICAgICAgIGlmIChxdWFkLnBvaW50ICYmIChxdWFkLnBvaW50ICE9PSBub2RlKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbCA9IG5vZGUueCAtIHF1YWQucG9pbnQueCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHggPSBsO1xuICAgICAgICAgICAgICAgICAgICByID0gbm9kZS5yYWRpdXMgKyBxdWFkLnBvaW50LnJhZGl1cztcbiAgICAgICAgICAgICAgICAgICAgaWYgKE1hdGguYWJzKGwpIDwgcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbCA9IChsIC0gcikgLyBsICogLjAwNTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHggKj0gbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHggPSAgKG5vZGUueCA+IHF1YWQucG9pbnQueCAmJiB4IDwgMCkgPyAteCA6IHg7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlLnggKz0geDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWQucG9pbnQueCAtPSB4O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB4MSA+IG54MlxuICAgICAgICAgICAgICAgICAgICB8fCB4MiA8IG54MVxuICAgICAgICAgICAgICAgICAgICB8fCB5MSA+IG55MlxuICAgICAgICAgICAgICAgICAgICB8fCB5MiA8IG55MTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1vdmVSZXBlYXRlZExhYmVscyA9IGZ1bmN0aW9uKGxhYmVsLCB4KSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IHJlcGVhdGVkUmVnaW9uW2xhYmVsXTtcbiAgICAgICAgICAgIHN2Zy5zZWxlY3RBbGwoXCJ0ZXh0LlwiK25hbWUpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJ4XCIsIG5ld3gpO1xuICAgICAgICB9O1xuICAgICAgICBmb3JjZS5vbihcInRpY2tcIiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgdmFyIHEgPSBkMy5nZW9tLnF1YWR0cmVlKGxhYmVscyksXG4gICAgICAgICAgICAgICAgaSA9IDAsXG4gICAgICAgICAgICAgICAgbiA9IGxhYmVscy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAoKytpIDwgbikge1xuICAgICAgICAgICAgICAgIHEudmlzaXQoY29sbGlkZShsYWJlbHNbaV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgcG9zaXRpb24gb2YgdGhlIHRleHQgZWxlbWVudFxuICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgc3ZnLnNlbGVjdEFsbChcInRleHQucmVnaW9uTmFtZVwiKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwieFwiLCBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld3ggPSBsYWJlbHNbaSsrXS54O1xuICAgICAgICAgICAgICAgICAgICBtb3ZlUmVwZWF0ZWRMYWJlbHMoZC5uYW1lLCBuZXd4KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld3g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGZvcmNlLnN0YXJ0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0UmVnaW9ucyhyZWdpb25zKSB7XG4gICAgICAgIGZvciAoa2V5IGluIE9iamVjdC5rZXlzKHJlZ2lvbnMpKSB7XG5cbiAgICAgICAgICAgIHJlZ2lvbnNba2V5XS5zdGFydCA9IGdldFJlZ2lvblN0YXJ0KHJlZ2lvbnNba2V5XS5jb29yZCk7XG4gICAgICAgICAgICByZWdpb25zW2tleV0uZW5kID0gZ2V0UmVnaW9uRW5kKHJlZ2lvbnNba2V5XS5jb29yZCk7XG4gICAgICAgICAgICBpZiAocmVnaW9uc1trZXldLnN0YXJ0ID09IHJlZ2lvbnNba2V5XS5lbmQpIHtcbiAgICAgICAgICAgICAgICByZWdpb25zW2tleV0uc3RhcnQgLT0gMC40O1xuICAgICAgICAgICAgICAgIHJlZ2lvbnNba2V5XS5lbmQgKz0gMC40O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVnaW9uc1trZXldLmNvbG9yID0gZ2V0Q29sb3IocmVnaW9uc1trZXldLm5hbWUpO1xuICAgICAgICAgICAgLypyZWdpb25MaXN0LnB1c2goe1xuICAgICAgICAgICAgICAgICduYW1lJzoga2V5LFxuICAgICAgICAgICAgICAgICdzdGFydCc6IGdldFJlZ2lvblN0YXJ0KHJlZ2lvbnNba2V5XSksXG4gICAgICAgICAgICAgICAgJ2VuZCc6IGdldFJlZ2lvbkVuZChyZWdpb25zW2tleV0pLFxuICAgICAgICAgICAgICAgICdjb2xvcic6IGdldENvbG9yKGtleSlcbiAgICAgICAgICAgIH0pOyovXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlZ2lvbnM7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiByZWdpb25EYXRhID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgLy8gYXNzdW1lIGRhdGEgaXMgaW4gYSBmaWxlXG4gICAgICAgIGQzLmpzb24ocmVnaW9uRGF0YSwgZnVuY3Rpb24oZXJyb3IsIHJlZ2lvbnMpIHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge3JldHVybiBjb25zb2xlLmRlYnVnKGVycm9yKX1cbiAgICAgICAgICAgIHJlZ2lvbkxpc3QgPSBmb3JtYXRSZWdpb25zKHJlZ2lvbnMpO1xuICAgICAgICAgICAgZHJhdyhyZWdpb25MaXN0KTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVnaW9uTGlzdCA9IGZvcm1hdFJlZ2lvbnMocmVnaW9uRGF0YSk7XG4gICAgICAgIGRyYXcocmVnaW9uTGlzdCk7XG4gICAgfVxuXG59O1xuXG5cbk11dHNOZWVkbGVQbG90LnByb3RvdHlwZS5kcmF3QXhlcyA9IGZ1bmN0aW9uKHN2Zykge1xuXG4gICAgdmFyIHkgPSB0aGlzLnk7XG4gICAgdmFyIHggPSB0aGlzLng7XG5cbiAgICB4QXhpcyA9IGQzLnN2Zy5heGlzKCkuc2NhbGUoeCkub3JpZW50KFwiYm90dG9tXCIpO1xuXG4gICAgc3ZnLmFwcGVuZChcInN2ZzpnXCIpXG4gICAgICAuYXR0cihcImNsYXNzXCIsIFwieC1heGlzIGF4aXNcIilcbiAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsXCIgKyAodGhpcy5oZWlnaHQgLSB0aGlzLmJ1ZmZlcikgKyBcIilcIilcbiAgICAgIC5jYWxsKHhBeGlzKTtcblxuICAgIHlBeGlzID0gZDMuc3ZnLmF4aXMoKS5zY2FsZSh5KS5vcmllbnQoXCJsZWZ0XCIpO1xuXG5cbiAgICBzdmcuYXBwZW5kKFwic3ZnOmdcIilcbiAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ5LWF4aXMgYXhpc1wiKVxuICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoXCIgKyAodGhpcy5idWZmZXIgKiAxLjIgKyAtIDEwKSAgKyBcIiwwKVwiKVxuICAgICAgLmNhbGwoeUF4aXMpO1xuXG4gICAgLy8gYXBwZWFyYW5jZSBmb3IgeCBhbmQgeSBsZWdlbmRcbiAgICBzdmcuc2VsZWN0QWxsKFwiLmF4aXMgcGF0aFwiKVxuICAgICAgICAuYXR0cignZmlsbCcsICdub25lJyk7XG4gICAgc3ZnLnNlbGVjdEFsbChcIi5kb21haW5cIilcbiAgICAgICAgLmF0dHIoJ3N0cm9rZScsICdibGFjaycpXG4gICAgICAgIC5hdHRyKCdzdHJva2Utd2lkdGgnLCAxKTtcblxuICAgIHN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ5LWxhYmVsXCIpXG4gICAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoXCIgKyAodGhpcy5idWZmZXIgLyAzKSArIFwiLFwiICsgKHRoaXMuaGVpZ2h0IC8gMikgKyBcIiksIHJvdGF0ZSgtOTApXCIpXG4gICAgICAgIC50ZXh0KHRoaXMubGVnZW5kcy55KVxuICAgICAgICAuYXR0cignZm9udC13ZWlnaHQnLCAnYm9sZCcpXG4gICAgICAgIC5hdHRyKCdmb250LXNpemUnLCAxMik7XG5cbiAgICBzdmcuYXBwZW5kKFwidGV4dFwiKVxuICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ4LWxhYmVsXCIpXG4gICAgICAgICAgLmF0dHIoXCJ0ZXh0LWFuY2hvclwiLCBcIm1pZGRsZVwiKVxuICAgICAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgKHRoaXMud2lkdGggLyAyKSArIFwiLFwiICsgKHRoaXMuaGVpZ2h0IC0gdGhpcy5idWZmZXIgLyAzKSArIFwiKVwiKVxuICAgICAgICAgIC50ZXh0KHRoaXMubGVnZW5kcy54KVxuICAgICAgICAuYXR0cignZm9udC13ZWlnaHQnLCAnYm9sZCcpXG4gICAgICAgIC5hdHRyKCdmb250LXNpemUnLCAxMik7XG4gICAgXG59O1xuXG5cblxuTXV0c05lZWRsZVBsb3QucHJvdG90eXBlLmRyYXdOZWVkbGVzID0gZnVuY3Rpb24oc3ZnLCBtdXRhdGlvbkRhdGEsIHJlZ2lvbkRhdGEpIHtcblxuICAgIHZhciB5ID0gdGhpcy55O1xuICAgIHZhciB4ID0gdGhpcy54O1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBnZXRZQXhpcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4geTtcbiAgICB9O1xuXG4gICAgdmFyIGZvcm1hdENvb3JkID0gZnVuY3Rpb24oY29vcmQpIHtcbiAgICAgICBpZiAoY29vcmQuaW5kZXhPZihcIi1cIikgPiAtMSkge1xuICAgICAgICAgICBjb29yZHMgPSBjb29yZC5zcGxpdChcIi1cIik7XG5cbiAgICAgICAgICAgLy8gcGxhY2UgbmVlZGUgYXQgbWlkZGxlIG9mIGFmZmVjdGVkIHJlZ2lvblxuICAgICAgICAgICBjb29yZCA9IE1hdGguZmxvb3IoKHBhcnNlSW50KGNvb3Jkc1swXSkgKyBwYXJzZUludChjb29yZHNbMV0pKSAvIDIpO1xuXG4gICAgICAgICAgIC8vIGNoZWNrIGZvciBzcGxpY2Ugc2l0ZXM6IFwiPy05XCIgb3IgXCI5LT9cIlxuICAgICAgICAgICBpZiAoaXNOYU4oY29vcmQpKSB7XG4gICAgICAgICAgICAgICBpZiAoY29vcmRzWzBdID09IFwiP1wiKSB7IGNvb3JkID0gcGFyc2VJbnQoY29vcmRzWzFdKSB9XG4gICAgICAgICAgICAgICBlbHNlIGlmIChjb29yZHMgWzFdID09IFwiP1wiKSB7IGNvb3JkID0gcGFyc2VJbnQoY29vcmRzWzBdKSB9XG4gICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvb3JkID0gcGFyc2VJbnQoY29vcmQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb29yZDtcbiAgICB9O1xuXG4gICAgdmFyIHRpcCA9IHRoaXMudGlwO1xuXG4gICAgLy8gc3RhY2sgbmVlZGxlcyBhdCBzYW1lIHBvc1xuICAgIHZhciBuZWVkbGVQb2ludCA9IHt9O1xuICAgIHZhciBoaWdoZXN0ID0gMDtcblxuICAgIHZhciBzdGFja05lZWRsZSA9IGZ1bmN0aW9uKHBvcywgdmFsdWUsIHBvaW50RGljdCkge1xuICAgICAgICB2YXIgc3RpY2tIZWlnaHQgPSAwO1xuICAgICAgICBwb3MgPSAncCcgKyBTdHJpbmcocG9zKTtcbiAgICAgICAgaWYgKHBvcyBpbiBwb2ludERpY3QpIHtcbiAgICAgICAgICAgIHN0aWNrSGVpZ2h0ID0gcG9pbnREaWN0W3Bvc107XG4gICAgICAgICAgICBuZXdIZWlnaHQgPSBzdGlja0hlaWdodCArIHZhbHVlO1xuICAgICAgICAgICAgcG9pbnREaWN0W3Bvc10gPSBuZXdIZWlnaHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb2ludERpY3RbcG9zXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdGlja0hlaWdodDtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZm9ybWF0TXV0YXRpb25FbnRyeShkKSB7XG5cbiAgICAgICAgdmFyIGNvb3JkU3RyaW5nID0gZC5jb29yZDtcbiAgICAgICAgdmFyIG51bWVyaWNDb29yZCA9IGZvcm1hdENvb3JkKGQuY29vcmQpO1xuICAgICAgICB2YXIgbnVtZXJpY1ZhbHVlID0gTnVtYmVyKGQudmFsdWUpO1xuICAgICAgICB2YXIgc3RpY2tIZWlnaHQgPSBzdGFja05lZWRsZShudW1lcmljQ29vcmQsIG51bWVyaWNWYWx1ZSwgbmVlZGxlUG9pbnQpO1xuICAgICAgICB2YXIgY2F0ZWdvcnkgPSBkLmNhdGVnb3J5IHx8IFwib3RoZXJcIjtcblxuICAgICAgICBpZiAoc3RpY2tIZWlnaHQgKyBudW1lcmljVmFsdWUgPiBoaWdoZXN0KSB7XG4gICAgICAgICAgICAvLyBzZXQgWS1BeGlzIGFsd2F5cyB0byBoaWdoZXN0IGF2YWlsYWJsZVxuICAgICAgICAgICAgaGlnaGVzdCA9IHN0aWNrSGVpZ2h0ICsgbnVtZXJpY1ZhbHVlO1xuICAgICAgICAgICAgZ2V0WUF4aXMoKS5kb21haW4oWzAsIGhpZ2hlc3QgKyAyXSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmIChudW1lcmljQ29vcmQgPiAwKSB7XG5cbiAgICAgICAgICAgIC8vIHJlY29yZCBhbmQgY291bnQgY2F0ZWdvcmllc1xuICAgICAgICAgICAgc2VsZi50b3RhbENhdGVnQ291bnRzW2NhdGVnb3J5XSA9IChzZWxmLnRvdGFsQ2F0ZWdDb3VudHNbY2F0ZWdvcnldIHx8IDApICsgbnVtZXJpY1ZhbHVlO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICBjb29yZFN0cmluZzogY29vcmRTdHJpbmcsXG4gICAgICAgICAgICAgICAgY29vcmQ6IG51bWVyaWNDb29yZCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbnVtZXJpY1ZhbHVlLFxuICAgICAgICAgICAgICAgIHN0aWNrSGVpZ2h0OiBzdGlja0hlaWdodCxcbiAgICAgICAgICAgICAgICBjb2xvcjogc2VsZi5jb2xvclNjYWxlKGNhdGVnb3J5KVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5kZWJ1ZyhcImRpc2NhcmRpbmcgXCIgKyBkLmNvb3JkICsgXCIgXCIgKyBkLmNhdGVnb3J5ICsgXCIoXCIrIG51bWVyaWNDb29yZCArXCIpXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIG11dHNcbiAgICBpZiAodHlwZW9mIG11dGF0aW9uRGF0YSA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGQzLmpzb24obXV0YXRpb25EYXRhLCBmdW5jdGlvbihlcnJvciwgdW5mb3JtYXR0ZWRNdXRzKSB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG11dHMgPSBwcmVwYXJlTXV0cyh1bmZvcm1hdHRlZE11dHMpO1xuICAgICAgICAgICAgcGFpbnRNdXRzKG11dHMpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtdXRzID0gcHJlcGFyZU11dHMobXV0YXRpb25EYXRhKTtcbiAgICAgICAgcGFpbnRNdXRzKG11dHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByZXBhcmVNdXRzKHVuZm9ybWF0dGVkTXV0cykge1xuICAgICAgICB2YXIgbXV0cyA9IFtdXG4gICAgICAgIHZhciBrZXlcbiAgICAgICAgZm9yIChrZXkgaW4gdW5mb3JtYXR0ZWRNdXRzKSB7XG4gICAgICAgICAgICB2YXIgZm9ybWF0dGVkID0gZm9ybWF0TXV0YXRpb25FbnRyeSh1bmZvcm1hdHRlZE11dHNba2V5XSk7XG4gICAgICAgICAgICBpZiAoZm9ybWF0dGVkICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG11dHMucHVzaChmb3JtYXR0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtdXRzO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gcGFpbnRNdXRzKG11dHMpIHtcblxuICAgICAgICB2YXIgbWluU2l6ZSA9IDQ7XG4gICAgICAgIHZhciBtYXhTaXplID0gMTA7XG4gICAgICAgIHZhciBoZWFkU2l6ZVNjYWxlID0gZDMuc2NhbGUubG9nKCkucmFuZ2UoW21pblNpemUsbWF4U2l6ZV0pLmRvbWFpbihbMSwgaGlnaGVzdC8yXSk7XG4gICAgICAgIHZhciBoZWFkU2l6ZSA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICAgIHJldHVybiBkMy5taW4oW2QzLm1heChbaGVhZFNpemVTY2FsZShuKSxtaW5TaXplXSksIG1heFNpemVdKTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgbmVlZGxlcyA9IHN2Zy5zZWxlY3RBbGwoKSAvLyBkMy5zZWxlY3QoXCIubXV0bmVlZGxlc1wiKS5zZWxlY3RBbGwoKVxuICAgICAgICAgICAgLmRhdGEobXV0cykuZW50ZXIoKVxuICAgICAgICAgICAgLmFwcGVuZChcImxpbmVcIilcbiAgICAgICAgICAgIC5hdHRyKFwieTFcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geShkYXRhLnN0aWNrSGVpZ2h0ICsgZGF0YS52YWx1ZSkgKyBoZWFkU2l6ZShkYXRhLnZhbHVlKSA7IH0gKVxuICAgICAgICAgICAgLmF0dHIoXCJ5MlwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiB5KGRhdGEuc3RpY2tIZWlnaHQpIH0pXG4gICAgICAgICAgICAuYXR0cihcIngxXCIsIGZ1bmN0aW9uKGRhdGEpIHsgcmV0dXJuIHgoZGF0YS5jb29yZCkgfSlcbiAgICAgICAgICAgIC5hdHRyKFwieDJcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geChkYXRhLmNvb3JkKSB9KVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcIm5lZWRsZS1saW5lXCIpXG4gICAgICAgICAgICAuYXR0cihcInN0cm9rZVwiLCBcImJsYWNrXCIpXG4gICAgICAgICAgICAuYXR0cihcInN0cm9rZS13aWR0aFwiLCAxKTtcblxuICAgICAgICB2YXIgbmVlZGxlSGVhZHMgPSBzdmcuc2VsZWN0QWxsKCkgLy8gZDMuc2VsZWN0KFwiLm11dG5lZWRsZXNcIikuc2VsZWN0QWxsKClcbiAgICAgICAgICAgIC5kYXRhKG11dHMpXG4gICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoXCJjaXJjbGVcIilcbiAgICAgICAgICAgIC5hdHRyKFwiY3lcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geShkYXRhLnN0aWNrSGVpZ2h0K2RhdGEudmFsdWUpIH0gKVxuICAgICAgICAgICAgLmF0dHIoXCJjeFwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiB4KGRhdGEuY29vcmQpIH0gKVxuICAgICAgICAgICAgLmF0dHIoXCJyXCIsIGZ1bmN0aW9uKGRhdGEpIHsgcmV0dXJuIGhlYWRTaXplKGRhdGEudmFsdWUpIH0pXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwibmVlZGxlLWhlYWRcIilcbiAgICAgICAgICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4gZGF0YS5jb2xvciB9KVxuICAgICAgICAgICAgLnN0eWxlKFwic3Ryb2tlXCIsIGZ1bmN0aW9uKGRhdGEpIHtyZXR1cm4gZDMucmdiKGRhdGEuY29sb3IpLmRhcmtlcigpfSlcbiAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgIGZ1bmN0aW9uKGQpeyBkMy5zZWxlY3QodGhpcykubW92ZVRvRnJvbnQoKTsgdGlwLnNob3coZCk7IH0pXG4gICAgICAgICAgICAub24oJ21vdXNlb3V0JywgdGlwLmhpZGUpO1xuXG4gICAgICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUubW92ZVRvRnJvbnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQodGhpcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBhZGp1c3QgeS1zY2FsZSBhY2NvcmRpbmcgdG8gaGlnaGVzdCB2YWx1ZSBhbiBkcmF3IHRoZSByZXN0XG4gICAgICAgIGlmIChyZWdpb25EYXRhICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc2VsZi5kcmF3UmVnaW9ucyhzdmcsIHJlZ2lvbkRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuZHJhd0xlZ2VuZChzdmcpO1xuICAgICAgICBzZWxmLmRyYXdBeGVzKHN2Zyk7XG5cbiAgICAgICAgLyogQnJpbmcgbmVlZGxlIGhlYWRzIGluIGZyb250IG9mIHJlZ2lvbnMgKi9cbiAgICAgICAgbmVlZGxlSGVhZHMuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG59O1xuXG5cblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJ2Jpb2pzLWV2ZW50cycpO1xuRXZlbnRzLm1peGluKE11dHNOZWVkbGVQbG90LnByb3RvdHlwZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTXV0c05lZWRsZVBsb3Q7XG5cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vc3JjL2pzL011dHNOZWVkbGVQbG90LmpzXCIpO1xuIl19
