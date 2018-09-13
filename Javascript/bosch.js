/*
 * ----------------------------- JSTORAGE -------------------------------------
 * Simple local storage wrapper to save data on the browser side, supporting
 * all major browsers - IE6+, Firefox2+, Safari4+, Chrome4+ and Opera 10.5+
 *
 * Author: Andris Reinman, andris.reinman@gmail.com
 * Project homepage: www.jstorage.info
 *
 * Licensed under Unlicense:
 *
 * This is free and unencumbered software released into the public domain.
 *
 * Anyone is free to copy, modify, publish, use, compile, sell, or
 * distribute this software, either in source code form or as a compiled
 * binary, for any purpose, commercial or non-commercial, and by any
 * means.
 *
 * In jurisdictions that recognize copyright laws, the author or authors
 * of this software dedicate any and all copyright interest in the
 * software to the public domain. We make this dedication for the benefit
 * of the public at large and to the detriment of our heirs and
 * successors. We intend this dedication to be an overt act of
 * relinquishment in perpetuity of all present and future rights to this
 * software under copyright law.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * For more information, please refer to <http://unlicense.org/>
 */

/* global ActiveXObject: false */
/* jshint browser: true */

(function() {
  "use strict";

  var /* jStorage version */
    JSTORAGE_VERSION = "0.4.12",
    /* detect a dollar object or create one if not found */
    $ = window.jQuery || window.$ || (window.$ = {}),
    /* check for a JSON handling support */
    JSON = {
      parse:
        (window.JSON && (window.JSON.parse || window.JSON.decode)) ||
        (String.prototype.evalJSON &&
          function(str) {
            return String(str).evalJSON();
          }) ||
        $.parseJSON ||
        $.evalJSON,
      stringify:
        Object.toJSON ||
        (window.JSON && (window.JSON.stringify || window.JSON.encode)) ||
        $.toJSON
    };

  // Break if no JSON support was found
  if (
    typeof JSON.parse !== "function" ||
    typeof JSON.stringify !== "function"
  ) {
    throw new Error(
      "No JSON support found, include //cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.js to page"
    );
  }

  var /* This is the object, that holds the cached values */
    _storage = {
      __jstorage_meta: {
        CRC32: {}
      }
    },
    /* Actual browser storage (localStorage or globalStorage['domain']) */
    _storage_service = {
      jStorage: "{}"
    },
    /* DOM element for older IE versions, holds userData behavior */
    _storage_elm = null,
    /* How much space does the storage take */
    _storage_size = 0,
    /* which backend is currently used */
    _backend = false,
    /* onchange observers */
    _observers = {},
    /* timeout to wait after onchange event */
    _observer_timeout = false,
    /* last update time */
    _observer_update = 0,
    /* pubsub observers */
    _pubsub_observers = {},
    /* skip published items older than current timestamp */
    _pubsub_last = +new Date(),
    /* Next check for TTL */
    _ttl_timeout,
    /**
     * XML encoding and decoding as XML nodes can't be JSON'ized
     * XML nodes are encoded and decoded if the node is the value to be saved
     * but not if it's as a property of another object
     * Eg. -
     *   $.jStorage.set('key', xmlNode);        // IS OK
     *   $.jStorage.set('key', {xml: xmlNode}); // NOT OK
     */
    _XMLService = {
      /**
       * Validates a XML node to be XML
       * based on jQuery.isXML function
       */
      isXML: function(elm) {
        var documentElement = (elm ? elm.ownerDocument || elm : 0)
          .documentElement;
        return documentElement ? documentElement.nodeName !== "HTML" : false;
      },

      /**
       * Encodes a XML node to string
       * based on http://www.mercurytide.co.uk/news/article/issues-when-working-ajax/
       */
      encode: function(xmlNode) {
        if (!this.isXML(xmlNode)) {
          return false;
        }
        try {
          // Mozilla, Webkit, Opera
          return new XMLSerializer().serializeToString(xmlNode);
        } catch (E1) {
          try {
            // IE
            return xmlNode.xml;
          } catch (E2) {}
        }
        return false;
      },

      /**
       * Decodes a XML node from string
       * loosely based on http://outwestmedia.com/jquery-plugins/xmldom/
       */
      decode: function(xmlString) {
        var dom_parser =
            ("DOMParser" in window && new DOMParser().parseFromString) ||
            (window.ActiveXObject &&
              function(_xmlString) {
                var xml_doc = new ActiveXObject("Microsoft.XMLDOM");
                xml_doc.async = "false";
                xml_doc.loadXML(_xmlString);
                return xml_doc;
              }),
          resultXML;
        if (!dom_parser) {
          return false;
        }
        resultXML = dom_parser.call(
          ("DOMParser" in window && new DOMParser()) || window,
          xmlString,
          "text/xml"
        );
        return this.isXML(resultXML) ? resultXML : false;
      }
    };

  ////////////////////////// PRIVATE METHODS ////////////////////////

  /**
   * Initialization function. Detects if the browser supports DOM Storage
   * or userData behavior and behaves accordingly.
   */
  function _init() {
    /* Check if browser supports localStorage */
    var localStorageReallyWorks = false;
    if ("localStorage" in window) {
      try {
        window.localStorage.setItem("_tmptest", "tmpval");
        localStorageReallyWorks = true;
        window.localStorage.removeItem("_tmptest");
      } catch (BogusQuotaExceededErrorOnIos5) {
        // Thanks be to iOS5 Private Browsing mode which throws
        // QUOTA_EXCEEDED_ERRROR DOM Exception 22.
      }
    }

    if (localStorageReallyWorks) {
      try {
        if (window.localStorage) {
          _storage_service = window.localStorage;
          _backend = "localStorage";
          _observer_update = _storage_service.jStorage_update;
        }
      } catch (E3) {
        /* Firefox fails when touching localStorage and cookies are disabled */
      }
    } else if ("globalStorage" in window) {
      /* Check if browser supports globalStorage */
      try {
        if (window.globalStorage) {
          if (window.location.hostname == "localhost") {
            _storage_service = window.globalStorage["localhost.localdomain"];
          } else {
            _storage_service = window.globalStorage[window.location.hostname];
          }
          _backend = "globalStorage";
          _observer_update = _storage_service.jStorage_update;
        }
      } catch (E4) {
        /* Firefox fails when touching localStorage and cookies are disabled */
      }
    } else {
      /* Check if browser supports userData behavior */
      _storage_elm = document.createElement("link");
      if (_storage_elm.addBehavior) {
        /* Use a DOM element to act as userData storage */
        _storage_elm.style.behavior = "url(#default#userData)";

        /* userData element needs to be inserted into the DOM! */
        document.getElementsByTagName("head")[0].appendChild(_storage_elm);

        try {
          _storage_elm.load("jStorage");
        } catch (E) {
          // try to reset cache
          _storage_elm.setAttribute("jStorage", "{}");
          _storage_elm.save("jStorage");
          _storage_elm.load("jStorage");
        }

        var data = "{}";
        try {
          data = _storage_elm.getAttribute("jStorage");
        } catch (E5) {}

        try {
          _observer_update = _storage_elm.getAttribute("jStorage_update");
        } catch (E6) {}

        _storage_service.jStorage = data;
        _backend = "userDataBehavior";
      } else {
        _storage_elm = null;
        return;
      }
    }

    // Load data from storage
    _load_storage();

    // remove dead keys
    _handleTTL();

    // start listening for changes
    _setupObserver();

    // initialize publish-subscribe service
    _handlePubSub();

    // handle cached navigation
    if ("addEventListener" in window) {
      window.addEventListener(
        "pageshow",
        function(event) {
          if (event.persisted) {
            _storageObserver();
          }
        },
        false
      );
    }
  }

  /**
   * Reload data from storage when needed
   */
  function _reloadData() {
    var data = "{}";

    if (_backend == "userDataBehavior") {
      _storage_elm.load("jStorage");

      try {
        data = _storage_elm.getAttribute("jStorage");
      } catch (E5) {}

      try {
        _observer_update = _storage_elm.getAttribute("jStorage_update");
      } catch (E6) {}

      _storage_service.jStorage = data;
    }

    _load_storage();

    // remove dead keys
    _handleTTL();

    _handlePubSub();
  }

  /**
   * Sets up a storage change observer
   */
  function _setupObserver() {
    if (_backend == "localStorage" || _backend == "globalStorage") {
      if ("addEventListener" in window) {
        window.addEventListener("storage", _storageObserver, false);
      } else {
        document.attachEvent("onstorage", _storageObserver);
      }
    } else if (_backend == "userDataBehavior") {
      setInterval(_storageObserver, 1000);
    }
  }

  /**
   * Fired on any kind of data change, needs to check if anything has
   * really been changed
   */
  function _storageObserver() {
    var updateTime;
    // cumulate change notifications with timeout
    clearTimeout(_observer_timeout);
    _observer_timeout = setTimeout(function() {
      if (_backend == "localStorage" || _backend == "globalStorage") {
        updateTime = _storage_service.jStorage_update;
      } else if (_backend == "userDataBehavior") {
        _storage_elm.load("jStorage");
        try {
          updateTime = _storage_elm.getAttribute("jStorage_update");
        } catch (E5) {}
      }

      if (updateTime && updateTime != _observer_update) {
        _observer_update = updateTime;
        _checkUpdatedKeys();
      }
    }, 25);
  }

  /**
   * Reloads the data and checks if any keys are changed
   */
  function _checkUpdatedKeys() {
    var oldCrc32List = JSON.parse(
        JSON.stringify(_storage.__jstorage_meta.CRC32)
      ),
      newCrc32List;

    _reloadData();
    newCrc32List = JSON.parse(JSON.stringify(_storage.__jstorage_meta.CRC32));

    var key,
      updated = [],
      removed = [];

    for (key in oldCrc32List) {
      if (oldCrc32List.hasOwnProperty(key)) {
        if (!newCrc32List[key]) {
          removed.push(key);
          continue;
        }
        if (
          oldCrc32List[key] != newCrc32List[key] &&
          String(oldCrc32List[key]).substr(0, 2) == "2."
        ) {
          updated.push(key);
        }
      }
    }

    for (key in newCrc32List) {
      if (newCrc32List.hasOwnProperty(key)) {
        if (!oldCrc32List[key]) {
          updated.push(key);
        }
      }
    }

    _fireObservers(updated, "updated");
    _fireObservers(removed, "deleted");
  }

  /**
   * Fires observers for updated keys
   *
   * @param {Array|String} keys Array of key names or a key
   * @param {String} action What happened with the value (updated, deleted, flushed)
   */
  function _fireObservers(keys, action) {
    keys = [].concat(keys || []);

    var i, j, len, jlen;

    if (action == "flushed") {
      keys = [];
      for (var key in _observers) {
        if (_observers.hasOwnProperty(key)) {
          keys.push(key);
        }
      }
      action = "deleted";
    }
    for (i = 0, len = keys.length; i < len; i++) {
      if (_observers[keys[i]]) {
        for (j = 0, jlen = _observers[keys[i]].length; j < jlen; j++) {
          _observers[keys[i]][j](keys[i], action);
        }
      }
      if (_observers["*"]) {
        for (j = 0, jlen = _observers["*"].length; j < jlen; j++) {
          _observers["*"][j](keys[i], action);
        }
      }
    }
  }

  /**
   * Publishes key change to listeners
   */
  function _publishChange() {
    var updateTime = (+new Date()).toString();

    if (_backend == "localStorage" || _backend == "globalStorage") {
      try {
        _storage_service.jStorage_update = updateTime;
      } catch (E8) {
        // safari private mode has been enabled after the jStorage initialization
        _backend = false;
      }
    } else if (_backend == "userDataBehavior") {
      _storage_elm.setAttribute("jStorage_update", updateTime);
      _storage_elm.save("jStorage");
    }

    _storageObserver();
  }

  /**
   * Loads the data from the storage based on the supported mechanism
   */
  function _load_storage() {
    /* if jStorage string is retrieved, then decode it */
    if (_storage_service.jStorage) {
      try {
        _storage = JSON.parse(String(_storage_service.jStorage));
      } catch (E6) {
        _storage_service.jStorage = "{}";
      }
    } else {
      _storage_service.jStorage = "{}";
    }
    _storage_size = _storage_service.jStorage
      ? String(_storage_service.jStorage).length
      : 0;

    if (!_storage.__jstorage_meta) {
      _storage.__jstorage_meta = {};
    }
    if (!_storage.__jstorage_meta.CRC32) {
      _storage.__jstorage_meta.CRC32 = {};
    }
  }

  /**
   * This functions provides the 'save' mechanism to store the jStorage object
   */
  function _save() {
    _dropOldEvents(); // remove expired events
    try {
      _storage_service.jStorage = JSON.stringify(_storage);
      // If userData is used as the storage engine, additional
      if (_storage_elm) {
        _storage_elm.setAttribute("jStorage", _storage_service.jStorage);
        _storage_elm.save("jStorage");
      }
      _storage_size = _storage_service.jStorage
        ? String(_storage_service.jStorage).length
        : 0;
    } catch (E7) {
      /* probably cache is full, nothing is saved this way*/
    }
  }

  /**
   * Function checks if a key is set and is string or numberic
   *
   * @param {String} key Key name
   */
  function _checkKey(key) {
    if (typeof key != "string" && typeof key != "number") {
      throw new TypeError("Key name must be string or numeric");
    }
    if (key == "__jstorage_meta") {
      throw new TypeError("Reserved key name");
    }
    return true;
  }

  /**
   * Removes expired keys
   */
  function _handleTTL() {
    var curtime,
      i,
      TTL,
      CRC32,
      nextExpire = Infinity,
      changed = false,
      deleted = [];

    clearTimeout(_ttl_timeout);

    if (
      !_storage.__jstorage_meta ||
      typeof _storage.__jstorage_meta.TTL != "object"
    ) {
      // nothing to do here
      return;
    }

    curtime = +new Date();
    TTL = _storage.__jstorage_meta.TTL;

    CRC32 = _storage.__jstorage_meta.CRC32;
    for (i in TTL) {
      if (TTL.hasOwnProperty(i)) {
        if (TTL[i] <= curtime) {
          delete TTL[i];
          delete CRC32[i];
          delete _storage[i];
          changed = true;
          deleted.push(i);
        } else if (TTL[i] < nextExpire) {
          nextExpire = TTL[i];
        }
      }
    }

    // set next check
    if (nextExpire != Infinity) {
      _ttl_timeout = setTimeout(
        _handleTTL,
        Math.min(nextExpire - curtime, 0x7fffffff)
      );
    }

    // save changes
    if (changed) {
      _save();
      _publishChange();
      _fireObservers(deleted, "deleted");
    }
  }

  /**
   * Checks if there's any events on hold to be fired to listeners
   */
  function _handlePubSub() {
    var i, len;
    if (!_storage.__jstorage_meta.PubSub) {
      return;
    }
    var pubelm,
      _pubsubCurrent = _pubsub_last,
      needFired = [];

    for (i = len = _storage.__jstorage_meta.PubSub.length - 1; i >= 0; i--) {
      pubelm = _storage.__jstorage_meta.PubSub[i];
      if (pubelm[0] > _pubsub_last) {
        _pubsubCurrent = pubelm[0];
        needFired.unshift(pubelm);
      }
    }

    for (i = needFired.length - 1; i >= 0; i--) {
      _fireSubscribers(needFired[i][1], needFired[i][2]);
    }

    _pubsub_last = _pubsubCurrent;
  }

  /**
   * Fires all subscriber listeners for a pubsub channel
   *
   * @param {String} channel Channel name
   * @param {Mixed} payload Payload data to deliver
   */
  function _fireSubscribers(channel, payload) {
    if (_pubsub_observers[channel]) {
      for (var i = 0, len = _pubsub_observers[channel].length; i < len; i++) {
        // send immutable data that can't be modified by listeners
        try {
          _pubsub_observers[channel][i](
            channel,
            JSON.parse(JSON.stringify(payload))
          );
        } catch (E) {}
      }
    }
  }

  /**
   * Remove old events from the publish stream (at least 2sec old)
   */
  function _dropOldEvents() {
    if (!_storage.__jstorage_meta.PubSub) {
      return;
    }

    var retire = +new Date() - 2000;

    for (
      var i = 0, len = _storage.__jstorage_meta.PubSub.length;
      i < len;
      i++
    ) {
      if (_storage.__jstorage_meta.PubSub[i][0] <= retire) {
        // deleteCount is needed for IE6
        _storage.__jstorage_meta.PubSub.splice(
          i,
          _storage.__jstorage_meta.PubSub.length - i
        );
        break;
      }
    }

    if (!_storage.__jstorage_meta.PubSub.length) {
      delete _storage.__jstorage_meta.PubSub;
    }
  }

  /**
   * Publish payload to a channel
   *
   * @param {String} channel Channel name
   * @param {Mixed} payload Payload to send to the subscribers
   */
  function _publish(channel, payload) {
    if (!_storage.__jstorage_meta) {
      _storage.__jstorage_meta = {};
    }
    if (!_storage.__jstorage_meta.PubSub) {
      _storage.__jstorage_meta.PubSub = [];
    }

    _storage.__jstorage_meta.PubSub.unshift([+new Date(), channel, payload]);

    _save();
    _publishChange();
  }

  /**
   * JS Implementation of MurmurHash2
   *
   *  SOURCE: https://github.com/garycourt/murmurhash-js (MIT licensed)
   *
   * @author <a href='mailto:gary.court@gmail.com'>Gary Court</a>
   * @see http://github.com/garycourt/murmurhash-js
   * @author <a href='mailto:aappleby@gmail.com'>Austin Appleby</a>
   * @see http://sites.google.com/site/murmurhash/
   *
   * @param {string} str ASCII only
   * @param {number} seed Positive integer only
   * @return {number} 32-bit positive integer hash
   */

  function murmurhash2_32_gc(str, seed) {
    var l = str.length,
      h = seed ^ l,
      i = 0,
      k;

    while (l >= 4) {
      k =
        (str.charCodeAt(i) & 0xff) |
        ((str.charCodeAt(++i) & 0xff) << 8) |
        ((str.charCodeAt(++i) & 0xff) << 16) |
        ((str.charCodeAt(++i) & 0xff) << 24);

      k =
        (k & 0xffff) * 0x5bd1e995 +
        ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16);
      k ^= k >>> 24;
      k =
        (k & 0xffff) * 0x5bd1e995 +
        ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16);

      h =
        ((h & 0xffff) * 0x5bd1e995 +
          ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^
        k;

      l -= 4;
      ++i;
    }

    switch (l) {
      case 3:
        h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
      /* falls through */
      case 2:
        h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
      /* falls through */
      case 1:
        h ^= str.charCodeAt(i) & 0xff;
        h =
          (h & 0xffff) * 0x5bd1e995 +
          ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16);
    }

    h ^= h >>> 13;
    h =
      (h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16);
    h ^= h >>> 15;

    return h >>> 0;
  }

  ////////////////////////// PUBLIC INTERFACE /////////////////////////

  $.jStorage = {
    /* Version number */
    version: JSTORAGE_VERSION,

    /**
     * Sets a key's value.
     *
     * @param {String} key Key to set. If this value is not set or not
     *              a string an exception is raised.
     * @param {Mixed} value Value to set. This can be any value that is JSON
     *              compatible (Numbers, Strings, Objects etc.).
     * @param {Object} [options] - possible options to use
     * @param {Number} [options.TTL] - optional TTL value, in milliseconds
     * @return {Mixed} the used value
     */
    set: function(key, value, options) {
      _checkKey(key);

      options = options || {};

      // undefined values are deleted automatically
      if (typeof value == "undefined") {
        this.deleteKey(key);
        return value;
      }

      if (_XMLService.isXML(value)) {
        value = {
          _is_xml: true,
          xml: _XMLService.encode(value)
        };
      } else if (typeof value == "function") {
        return undefined; // functions can't be saved!
      } else if (value && typeof value == "object") {
        // clone the object before saving to _storage tree
        value = JSON.parse(JSON.stringify(value));
      }

      _storage[key] = value;

      _storage.__jstorage_meta.CRC32[key] =
        "2." + murmurhash2_32_gc(JSON.stringify(value), 0x9747b28c);

      this.setTTL(key, options.TTL || 0); // also handles saving and _publishChange

      _fireObservers(key, "updated");
      return value;
    },

    /**
     * Looks up a key in cache
     *
     * @param {String} key - Key to look up.
     * @param {mixed} def - Default value to return, if key didn't exist.
     * @return {Mixed} the key value, default value or null
     */
    get: function(key, def) {
      _checkKey(key);
      if (key in _storage) {
        if (
          _storage[key] &&
          typeof _storage[key] == "object" &&
          _storage[key]._is_xml
        ) {
          return _XMLService.decode(_storage[key].xml);
        } else {
          return _storage[key];
        }
      }
      return typeof def == "undefined" ? null : def;
    },

    /**
     * Deletes a key from cache.
     *
     * @param {String} key - Key to delete.
     * @return {Boolean} true if key existed or false if it didn't
     */
    deleteKey: function(key) {
      _checkKey(key);
      if (key in _storage) {
        delete _storage[key];
        // remove from TTL list
        if (
          typeof _storage.__jstorage_meta.TTL == "object" &&
          key in _storage.__jstorage_meta.TTL
        ) {
          delete _storage.__jstorage_meta.TTL[key];
        }

        delete _storage.__jstorage_meta.CRC32[key];

        _save();
        _publishChange();
        _fireObservers(key, "deleted");
        return true;
      }
      return false;
    },

    /**
     * Sets a TTL for a key, or remove it if ttl value is 0 or below
     *
     * @param {String} key - key to set the TTL for
     * @param {Number} ttl - TTL timeout in milliseconds
     * @return {Boolean} true if key existed or false if it didn't
     */
    setTTL: function(key, ttl) {
      var curtime = +new Date();
      _checkKey(key);
      ttl = Number(ttl) || 0;
      if (key in _storage) {
        if (!_storage.__jstorage_meta.TTL) {
          _storage.__jstorage_meta.TTL = {};
        }

        // Set TTL value for the key
        if (ttl > 0) {
          _storage.__jstorage_meta.TTL[key] = curtime + ttl;
        } else {
          delete _storage.__jstorage_meta.TTL[key];
        }

        _save();

        _handleTTL();

        _publishChange();
        return true;
      }
      return false;
    },

    /**
     * Gets remaining TTL (in milliseconds) for a key or 0 when no TTL has been set
     *
     * @param {String} key Key to check
     * @return {Number} Remaining TTL in milliseconds
     */
    getTTL: function(key) {
      var curtime = +new Date(),
        ttl;
      _checkKey(key);
      if (
        key in _storage &&
        _storage.__jstorage_meta.TTL &&
        _storage.__jstorage_meta.TTL[key]
      ) {
        ttl = _storage.__jstorage_meta.TTL[key] - curtime;
        return ttl || 0;
      }
      return 0;
    },

    /**
     * Deletes everything in cache.
     *
     * @return {Boolean} Always true
     */
    flush: function() {
      _storage = {
        __jstorage_meta: {
          CRC32: {}
        }
      };
      _save();
      _publishChange();
      _fireObservers(null, "flushed");
      return true;
    },

    /**
     * Returns a read-only copy of _storage
     *
     * @return {Object} Read-only copy of _storage
     */
    storageObj: function() {
      function F() {}
      F.prototype = _storage;
      return new F();
    },

    /**
     * Returns an index of all used keys as an array
     * ['key1', 'key2',..'keyN']
     *
     * @return {Array} Used keys
     */
    index: function() {
      var index = [],
        i;
      for (i in _storage) {
        if (_storage.hasOwnProperty(i) && i != "__jstorage_meta") {
          index.push(i);
        }
      }
      return index;
    },

    /**
     * How much space in bytes does the storage take?
     *
     * @return {Number} Storage size in chars (not the same as in bytes,
     *                  since some chars may take several bytes)
     */
    storageSize: function() {
      return _storage_size;
    },

    /**
     * Which backend is currently in use?
     *
     * @return {String} Backend name
     */
    currentBackend: function() {
      return _backend;
    },

    /**
     * Test if storage is available
     *
     * @return {Boolean} True if storage can be used
     */
    storageAvailable: function() {
      return !!_backend;
    },

    /**
     * Register change listeners
     *
     * @param {String} key Key name
     * @param {Function} callback Function to run when the key changes
     */
    listenKeyChange: function(key, callback) {
      _checkKey(key);
      if (!_observers[key]) {
        _observers[key] = [];
      }
      _observers[key].push(callback);
    },

    /**
     * Remove change listeners
     *
     * @param {String} key Key name to unregister listeners against
     * @param {Function} [callback] If set, unregister the callback, if not - unregister all
     */
    stopListening: function(key, callback) {
      _checkKey(key);

      if (!_observers[key]) {
        return;
      }

      if (!callback) {
        delete _observers[key];
        return;
      }

      for (var i = _observers[key].length - 1; i >= 0; i--) {
        if (_observers[key][i] == callback) {
          _observers[key].splice(i, 1);
        }
      }
    },

    /**
     * Subscribe to a Publish/Subscribe event stream
     *
     * @param {String} channel Channel name
     * @param {Function} callback Function to run when the something is published to the channel
     */
    subscribe: function(channel, callback) {
      channel = (channel || "").toString();
      if (!channel) {
        throw new TypeError("Channel not defined");
      }
      if (!_pubsub_observers[channel]) {
        _pubsub_observers[channel] = [];
      }
      _pubsub_observers[channel].push(callback);
    },

    /**
     * Publish data to an event stream
     *
     * @param {String} channel Channel name
     * @param {Mixed} payload Payload to deliver
     */
    publish: function(channel, payload) {
      channel = (channel || "").toString();
      if (!channel) {
        throw new TypeError("Channel not defined");
      }

      _publish(channel, payload);
    },

    /**
     * Reloads the data from browser storage
     */
    reInit: function() {
      _reloadData();
    },

    /**
     * Removes reference from global objects and saves it as jStorage
     *
     * @param {Boolean} option if needed to save object as simple 'jStorage' in windows context
     */
    noConflict: function(saveInGlobal) {
      delete window.$.jStorage;

      if (saveInGlobal) {
        window.jStorage = this;
      }

      return this;
    }
  };

  // Initialize jStorage
  _init();
})();
/*
   * jQuery JSON Plugin
   * version: 2.1 (2009-08-14)
   *
   * This document is licensed as free software under the terms of the
   * MIT License: http://www.opensource.org/licenses/mit-license.php
   *
   * Brantley Harris wrote this plugin. It is based somewhat on the JSON.org 
   * website's http://www.json.org/json2.js, which proclaims:
   * "NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.", a sentiment that
   * I uphold.
   *
   * It is also influenced heavily by MochiKit's serializeJSON, which is 
   * copyrighted 2005 by Bob Ippolito.
   */

(function($) {
  /** jQuery.toJSON( json-serializble )
     Converts the given argument into a JSON respresentation.
     
     If an object has a "toJSON" function, that will be used to get the representation.
     Non-integer/string keys are skipped in the object, as are keys that point to a function.
     
     json-serializble:
     The *thing* to be converted.
     **/
  $.toJSON = function(o) {
    if (typeof JSON == "object" && JSON.stringify) return JSON.stringify(o);

    var type = typeof o;

    if (o === null) return "null";

    if (type == "undefined") return undefined;

    if (type == "number" || type == "boolean") return o + "";

    if (type == "string") return $.quoteString(o);

    if (type == "object") {
      if (typeof o.toJSON == "function") return $.toJSON(o.toJSON());

      if (o.constructor === Date) {
        var month = o.getUTCMonth() + 1;
        if (month < 10) month = "0" + month;

        var day = o.getUTCDate();
        if (day < 10) day = "0" + day;

        var year = o.getUTCFullYear();

        var hours = o.getUTCHours();
        if (hours < 10) hours = "0" + hours;

        var minutes = o.getUTCMinutes();
        if (minutes < 10) minutes = "0" + minutes;

        var seconds = o.getUTCSeconds();
        if (seconds < 10) seconds = "0" + seconds;

        var milli = o.getUTCMilliseconds();
        if (milli < 100) milli = "0" + milli;
        if (milli < 10) milli = "0" + milli;

        return (
          '"' +
          year +
          "-" +
          month +
          "-" +
          day +
          "T" +
          hours +
          ":" +
          minutes +
          ":" +
          seconds +
          "." +
          milli +
          'Z"'
        );
      }

      if (o.constructor === Array) {
        var ret = [];
        for (var i = 0; i < o.length; i++) ret.push($.toJSON(o[i]) || "null");

        return "[" + ret.join(",") + "]";
      }

      var pairs = [];
      for (var k in o) {
        var name;
        var type = typeof k;

        if (type == "number") name = '"' + k + '"';
        else if (type == "string") name = $.quoteString(k);
        else continue; //skip non-string or number keys
        if (typeof o[k] == "function") continue; //skip pairs where the value is a function.
        var val = $.toJSON(o[k]);

        pairs.push(name + ":" + val);
      }

      return "{" + pairs.join(", ") + "}";
    }
  };

  /** jQuery.evalJSON(src)
     Evaluates a given piece of json source.
     **/
  $.evalJSON = function(src) {
    if (typeof JSON == "object" && JSON.parse) return JSON.parse(src);
    return eval("(" + src + ")");
  };

  /** jQuery.secureEvalJSON(src)
     Evals JSON in a way that is *more* secure.
     **/
  $.secureEvalJSON = function(src) {
    if (typeof JSON == "object" && JSON.parse) return JSON.parse(src);

    var filtered = src;
    filtered = filtered.replace(/\\["\\\/bfnrtu]/g, "@");
    filtered = filtered.replace(
      /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
      "]"
    );
    filtered = filtered.replace(/(?:^|:|,)(?:\s*\[)+/g, "");

    if (/^[\],:{}\s]*$/.test(filtered)) return eval("(" + src + ")");
    else throw new SyntaxError("Error parsing JSON, source is not valid.");
  };

  /** jQuery.quoteString(string)
     Returns a string-repr of a string, escaping quotes intelligently.  
     Mostly a support function for toJSON.
     
     Examples:
     >>> jQuery.quoteString("apple")
     "apple"
     
     >>> jQuery.quoteString('"Where are we going?", she asked.')
     "\"Where are we going?\", she asked."
     **/
  $.quoteString = function(string) {
    if (string.match(_escapeable)) {
      return (
        '"' +
        string.replace(_escapeable, function(a) {
          var c = _meta[a];
          if (typeof c === "string") return c;
          c = a.charCodeAt();
          return (
            "\\u00" + Math.floor(c / 16).toString(16) + (c % 16).toString(16)
          );
        }) +
        '"'
      );
    }
    return '"' + string + '"';
  };

  var _escapeable = /["\\\x00-\x1f\x7f-\x9f]/g;

  var _meta = {
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
    '"': '\\"',
    "\\": "\\\\"
  };
})(jQuery);
/**
	Utils to post requests to a web resource
*/

function HttpMessenger(iframebridgeId, responseManager, baseUrl) {
  this.responseManager = responseManager;

  var IFRAME = document.getElementById(iframebridgeId).contentWindow;

  var SERVICE_URL = baseUrl;

  /*
	 * Does a postMessage() to the iframebridge.
	 *
	 * @attribute 'request' (required) - Request URL.
	 * @attribute 'onSucces' (required) - Success callback method.
	 * @attribute 'onError' (required) - Error callback method.
	 * @attribute 'onRefine' (optional) - Callback method which will be executed before the onSucces callback.
	 */
  this.postMessageToWebServer = function(
    request,
    onSuccess,
    onError,
    onRefine
  ) {
    request.url = SERVICE_URL + request.url;
    if (request.url.indexOf("?") != -1) {
      request.url = request.url + "&requestToken=" + request.token;
    } else {
      request.url = request.url + "?requestToken=" + request.token;
    }

    var requestJSON = JSON.stringify(request);

    IFRAME.postMessage(requestJSON, "*");
    var tokenResponse = responseManager.createTokenResponse(
      request,
      onSuccess,
      onError,
      onRefine
    );
    responseManager.startWatching(
      request.token,
      request.timeout,
      tokenResponse
    );
  };

  /* 
	 * Register listener for message events.
	 */
  if (window.addEventListener) {
    window.addEventListener("message", handleOnMessage, false);
  } else if (window.attachEvent) {
    window.attachEvent("onmessage", handleOnMessage);
  }

  /*
	 * Common handler for onMessage-events sent by an iframebridge.
	 */
  function handleOnMessage(event) {
    /* 
		 * Drop all non JSON requests since the iFrame Bridge just talks JSON and thus the other requests can be dropped.
		 */
    try {
      var response = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    /*
		 * Assumption: if there is no token within the response, the event
		 * is no event which should be handled by this handler method.
		 */

    if (response.token === undefined) return;

    var tokenResponse = responseManager.get(response.token);

    /*
		 * Assumption: if there was no TokenResponse found for the token deliverd by the response, no more handling for this response is done.
		 * This could be the case for example if the timeout interval of the origin request was reached and therefore the request was marked 
		 * as handled unsuccessful already.
		 */

    if (tokenResponse === undefined) return;

    tokenResponse.response = response.data !== undefined ? response.data : "{}";
    var status = response.status;
    var data = tokenResponse.response;

    // status 1223: handles IE's error response when HTTP status is 204
    if ((status >= 200 && status < 300) || status == 1223) {
      // SUCCESS handling
      if (data !== undefined) {
        if (
          tokenResponse.handleInternal !== undefined &&
          tokenResponse.handleInternal === true
        ) {
          tokenResponse.onSuccess(status, data, response.token);
        } else {
          callback(tokenResponse.onSuccess, data);
        }
      } else {
        callback(tokenResponse.onSuccess);
      }
      responseManager.finish(response.token);
    } else {
      // ERROR handling
      if (
        tokenResponse.handleInternal !== undefined &&
        tokenResponse.handleInternal === true
      ) {
        tokenResponse.onError(status, data, response.token);
      } else {
        //no valid error message and WAM enforces authentication
        if (
          typeof data === "string" &&
          data.indexOf("httpStatus") == -1 &&
          status == 0
        ) {
          data = '{ "httpStatus": "0" }';
        }
        callback(tokenResponse.onError, data);
      }
      responseManager.finish(response.token);
    }
  }
}

/*
 * Monitors the processing of the TokenResponse for each managed token.
 */
function ResponseManager() {
  var responseStorage = {};

  /*
	 * Creates a new TokenResponse.
	 */
  this.createTokenResponse = function(request, onSuccess, onError, onRefine) {
    return new TokenResponse(request, onSuccess, onError, onRefine);
  };

  /*
	 * Get a TokenResponse by token.
	 */
  this.get = function(token) {
    return responseStorage[token];
  };

  /*
	 * Starts the timeout checking intervall for observing if a request will be handled within the timeout intervall.
	 */
  this.startWatching = function(token, timeout, tokenResponse) {
    responseStorage[token] = tokenResponse;
    var tokenManagerContext = this;
    window.setTimeout(function() {
      evaluateTokenAfterTimeout.call(tokenManagerContext, token);
    }, timeout);
  };

  /*
	 * Mark a response for a given token as finished (with succes or error) and handled within the timeout interval.
	 */
  this.finish = function(token) {
    responseStorage[token].state = "FINISHED";
  };

  /*
	 * Mark a response for a given token as refining.
	 * That means that there are some more steps to do before the service callback can be invoked. 
	 */
  this.refining = function(token) {
    responseStorage[token].state = "REFINING";
  };

  /*
	 * Checks if a response for a request with the given token has been handled within the timeout intervall.
	 * If a request cannot be handled within the timeout interval the onError callback method will be executed
	 * with the httpStatus 504.
	 */
  var evaluateTokenAfterTimeout = function(token) {
    var tokenResponse = responseStorage[token];

    switch (tokenResponse.state) {
      case "FINISHED":
        // response for this token was successful
        log(
          "TokenResponse successfully handled for request:" +
            tokenResponse.request.url
        );
        break;

      case "REFINING":
        /*
				 * If the state of the TokenResponse is still in REFINING call the success callback of the serive
				 * to fullfill the timeout contract with the service. Pending tasks to fulfill the response will be aborted.
				 */
        callback(tokenResponse.onSuccess, tokenResponse.response);

        log(
          "TokenResponse successfully handled for request:" +
            tokenResponse.request.url +
            " BUT not all dependencies could be injected into the response because of timeout limitations!"
        );
        break;

      default:
        // response not successful within timeout intervall
        var errorResponse = {};
        errorResponse.httpStatus = 504;
        callback(tokenResponse.onError, errorResponse);
        log(
          "TIMEOUT - TokenResponse NOT successfully handled for request:" +
            tokenResponse.request.url
        );
    }
    delete responseStorage[token];
  };

  /*
 	 * Persists which callback method should be executed if a request with a related token has been executed.
 	 * TokenResponses are managed by a ResponseManager.
 	 * The initial state of a new initialized TokenResponse is always STARTED.
 	 *
 	 * @attribute 'request' (required) - Request for which the response should be handled.
 	 * @attribute 'onSucces' (required) - Callback method if the response of the related token was successful.
 	 * @attribute 'onError' (required) - Callback method if the response of the related token was NOT successful.
 	 * @attribute 'onRefine' (optional) - Method which should be executed before the onSuccess-method. If the response
 	 *									  of the related token was NOT successful this method will NOT be executed too.
 	 */
  function TokenResponse(request, onSuccess, onError, onRefine) {
    this.state = "STARTED";
    this.request = request;
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.onRefine = onRefine;
  }
}

/*
 * A simple request representation.
 */
function Request(method, url) {
  this.token = getToken();
  this.method = method;
  this.url = url;
}

/*
 * Generates an unique token.
 */
function getToken() {
  return (
    new Date().getTime().toString() +
    Math.random()
      .toString()
      .substring(5)
  );
}

/*
 * Executes a given callback method.
 * If this method is called with a second parameter this will be uses a method parameter for the callback method.
 * Else the callback method will be executed without additional parameter.
 *
 * @attribute 'callbackMethod' (required) - The callback method.
 * @attribute 'callbackMethodParameter' (optional) - An additional parameter for the callback method.
 */
function callback(callbackMethod, callbackMethodParameter) {
  if (callbackMethodParameter === undefined) {
    callbackMethod();
  } else {
    if (typeof callbackMethodParameter === "string") {
      try {
        // JSON string -> object
        callbackMethodParameter = JSON.parse(callbackMethodParameter);
      } catch (e) {
        // callback without emptyparameter
        return callbackMethod("{}");
      }
    }
    callbackMethod(callbackMethodParameter);
  }
}

/*
 * Writes some unformatted text in the console of the browser.
 * If the console is not available, nothing will be logged.
 */
function log(text) {
  if (typeof console !== "undefined") {
    console.log(text);
  }
}

function logError(text) {
  if (typeof console !== "undefined") {
    console.error(text);
  }
}
function PostMessageManager(
  somIframebridgeId,
  bcIframebridgeId,
  responseManager
) {
  this.somIframebridgeId = somIframebridgeId;
  this.bcIframebridgeId = bcIframebridgeId;
  this.responseManager = responseManager;

  var SoM_FRAME = document.getElementById(somIframebridgeId).contentWindow;
  var BC_FRAME = document.getElementById(bcIframebridgeId).contentWindow;

  var SoM_SERVICE_URL = "https://inside-ws.bosch.com/bgnsom/rest/bgn";
  var BC_SERVICE_URL = "https://connect.bosch.com";

  /*
	 * Does a postMessage() to the SoM iframebridge.
	 *
	 * @attribute 'request' (required) - Request URL.
	 * @attribute 'onSucces' (required) - Success callback method.
	 * @attribute 'onError' (required) - Error callback method.
	 * @attribute 'onRefine' (optional) - Callback method which will be executed before the onSucces callback.
	 */
  this.postMessageToSoM = function(request, onSuccess, onError, onRefine) {
    request.url = SoM_SERVICE_URL + request.url;
    if (request.url.indexOf("?") != -1) {
      request.url = request.url + "&requestToken=" + request.token;
    } else {
      request.url = request.url + "?requestToken=" + request.token;
    }

    var requestJSON = jQuery.toJSON(request);

    SoM_FRAME.postMessage(requestJSON, "*");
    var tokenResponse = responseManager.createTokenResponse(
      request,
      onSuccess,
      onError,
      onRefine
    );
    responseManager.startWatching(
      request.token,
      request.timeout,
      tokenResponse
    );
  };

  /*
	 * Does a postMessage() to the BC iframebridge.
	 * PostMessages to the BC iframebridge are always handled internal which means
	 * that the caller is responsible to execute the service callback methods manually.
	 *
	 * @attribute 'request' (required) - Request URL.
	 * @attribute 'onSucces' (required) - Success callback method.
	 * @attribute 'onError' (required) - Error callback method.
	 * @attribute 'handleInternal' (optional) - Marks that a response should not call the service callback method directly.
	 * 											Instead the response will be handled by an internal method first,
	 *											which will execute the service callback method later.
	 */
  this.postMessageToBC = function(request, onSuccess, onError, handleInternal) {
    request.url = BC_SERVICE_URL + request.url;

    var requestJSON = jQuery.toJSON(request);

    BC_FRAME.postMessage(requestJSON, "*");
    var tokenResponse = responseManager.createTokenResponse(
      request,
      onSuccess,
      onError
    );
    if (handleInternal === undefined || handleInternal !== false) {
      tokenResponse.handleInternal = true;
    } else {
      tokenResponse.handleInternal = false;
    }
    responseManager.startWatching(
      request.token,
      request.timeout,
      tokenResponse
    );
  };

  /* 
	 * Register listener for message events.
	 */
  if (window.addEventListener) {
    window.addEventListener("message", handleOnMessage, false);
  } else if (window.attachEvent) {
    window.attachEvent("onmessage", handleOnMessage);
  }

  /*
	 * Common handler for onMessage-events sent by an iframebridge.
	 */
  function handleOnMessage(event) {
    /* 
		 * Drop all non JSON requests since the iFrame Bridge just talks JSON and thus the other requests can be dropped.
		 */
    try {
      var response = jQuery.parseJSON(event.data);
    } catch (e) {
      return;
    }

    /*
		 * Assumption: if there is no token within the response, the event
		 * is no event which should be handled by this handler method.
		 */

    if (response.token === undefined) return;

    var tokenResponse = responseManager.get(response.token);

    /*
		 * Assumption: if there was no TokenResponse found for the token deliverd by the response, no more handling for this response is done.
		 * This could be the case for example if the timeout interval of the origin request was reached and therefore the request was marked 
		 * as handled unsuccessful already.
		 */

    if (tokenResponse === undefined) return;

    tokenResponse.response = response.data !== undefined ? response.data : "{}";
    var status = response.status;
    var data = tokenResponse.response;

    // status 1223: handles IE's error response when HTTP status is 204
    if ((status >= 200 && status < 300) || status == 1223) {
      // SUCCESS handling
      if (tokenResponse.onRefine === undefined) {
        if (data !== undefined) {
          if (
            tokenResponse.handleInternal !== undefined &&
            tokenResponse.handleInternal === true
          ) {
            tokenResponse.onSuccess(status, data, response.token); // TODO: evtl. kompletten tokenResponse Ã¼bergeben?!?!
          } else {
            callback(tokenResponse.onSuccess, data);
          }
        } else {
          callback(tokenResponse.onSuccess);
        }
        responseManager.finish(response.token);
      } else {
        responseManager.refining(response.token);
        tokenResponse.onRefine(response.token);
      }
    } else {
      // ERROR handling
      if (
        tokenResponse.handleInternal !== undefined &&
        tokenResponse.handleInternal === true
      ) {
        tokenResponse.onError(status, data, response.token);
      } else {
        //no valid error message and WAM enforces authentication
        if (
          typeof data === "string" &&
          data.indexOf("httpStatus") == -1 &&
          status == 0
        ) {
          data = '{ "httpStatus": "0" }';
        }
        callback(tokenResponse.onError, data);
      }
      responseManager.finish(response.token);
    }
  }
}
/*
 * Monitors the processing of the TokenResponse for each managed token.
 */
function ResponseManager() {
  var responseStorage = {};
  var taskManager;

  this.setTaskManager = function(value) {
    taskManager = value;
  };

  /*
	 * Creates a new TokenResponse.
	 */
  this.createTokenResponse = function(request, onSuccess, onError, onRefine) {
    return new TokenResponse(request, onSuccess, onError, onRefine);
  };

  /*
	 * Get a TokenResponse by token.
	 */
  this.get = function(token) {
    return responseStorage[token];
  };

  /*
	 * Starts the timeout checking intervall for observing if a request will be handled within the timeout intervall.
	 */
  this.startWatching = function(token, timeout, tokenResponse) {
    responseStorage[token] = tokenResponse;
    var tokenManagerContext = this;
    window.setTimeout(function() {
      evaluateTokenAfterTimeout.call(tokenManagerContext, token);
    }, timeout);
  };

  /*
	 * Mark a response for a given token as finished (with succes or error) and handled within the timeout interval.
	 */
  this.finish = function(token) {
    responseStorage[token].state = "FINISHED";
  };

  /*
	 * Mark a response for a given token as refining.
	 * That means that there are some more steps to do before the service callback can be invoked. 
	 */
  this.refining = function(token) {
    responseStorage[token].state = "REFINING";
  };

  /*
	 * Checks if a response for a request with the given token has been handled within the timeout intervall.
	 * If a request cannot be handled within the timeout interval the onError callback method will be executed
	 * with the httpStatus 504.
	 */
  var evaluateTokenAfterTimeout = function(token) {
    var tokenResponse = responseStorage[token];

    switch (tokenResponse.state) {
      case "FINISHED":
        // response for this token was successful
        log(
          "TokenResponse successfully handled for request:" +
            tokenResponse.request.url
        );
        break;

      case "REFINING":
        /*
				 * If the state of the TokenResponse is still in REFINING call the success callback of the serive
				 * to fullfill the timeout contract with the service. Pending tasks to fulfill the response will be aborted.
				 */
        callback(tokenResponse.onSuccess, tokenResponse.response);
        taskManager.abort(tokenResponse.taskToken);

        log(
          "TokenResponse successfully handled for request:" +
            tokenResponse.request.url +
            " BUT not all dependencies could be injected into the response because of timeout limitations!"
        );
        break;

      default:
        // response not successful within timeout intervall
        var errorResponse = {};
        errorResponse.httpStatus = 504;
        callback(tokenResponse.onError, errorResponse);
        log(
          "TIMEOUT - TokenResponse NOT successfully handled for request:" +
            tokenResponse.request.url
        );
    }
    delete responseStorage[token];
  };

  /*
 	 * Persists which callback method should be executed if a request with a related token has been executed.
 	 * TokenResponses are managed by a ResponseManager.
 	 * The initial state of a new initialized TokenResponse is always STARTED.
 	 *
 	 * @attribute 'request' (required) - Request for which the response should be handled.
 	 * @attribute 'onSucces' (required) - Callback method if the response of the related token was successful.
 	 * @attribute 'onError' (required) - Callback method if the response of the related token was NOT successful.
 	 * @attribute 'onRefine' (optional) - Method which should be executed before the onSuccess-method. If the response
 	 *									  of the related token was NOT successful this method will NOT be executed too.
 	 */
  function TokenResponse(request, onSuccess, onError, onRefine) {
    this.state = "STARTED";
    this.request = request;
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.onRefine = onRefine;
  }
}
function SoMDataRepository(somIframebridgeId, bcIframebridgeId) {
  var taskManager = new TaskManager();
  var responseManager = new ResponseManager();
  var postMessageManager = new PostMessageManager(
    somIframebridgeId,
    bcIframebridgeId,
    responseManager
  );
  var userManager = new UserManager(
    postMessageManager,
    taskManager,
    responseManager
  );
  var isBZO = true; //(jQuery(location).attr("href").indexOf("bzo") != -1 || jQuery(location).attr("href").indexOf("wcms_bnn") != -1);

  taskManager.setResponseManager(responseManager);
  responseManager.setTaskManager(taskManager);

  /*
	 * Returns the aggregation resource for a given page.
	 */
  this.getAggregatedSomDataForPage = function(
    pageShortId,
    onSuccess,
    onError,
    numberOfComments,
    timeout
  ) {
    var url = "/page/" + pageShortId;
    if (
      numberOfComments !== undefined &&
      typeof numberOfComments === "number"
    ) {
      url += "/" + numberOfComments;
    }

    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * Returns my personalized like status (not liked / liked) for all sections of a given page and the page itself.
	 */
  this.getMyLikesForPage = function(pageShortId, onSuccess, onError, timeout) {
    var myLikesCacheKey = getMyLikesForPageCacheKey(pageShortId);
    if (isCached(myLikesCacheKey) && !isBZO) {
      callback(onSuccess, loadFromCache(myLikesCacheKey));
    } else {
      var url = "/page/" + pageShortId + "/me";
      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToSoM(
        request,
        function(myLikesResponse) {
          cache(myLikesCacheKey, myLikesResponse);
          callback(onSuccess, myLikesResponse);
        },
        onError
      );
    }
  };

  /*
	 * Gets the number of Comments / Likes for the given Record.
	 */
  this.getAggregatedSomDataForRecord = function(
    wcmsId,
    onSuccess,
    onError,
    numberOfComments,
    timeout
  ) {
    var url = "/record/" + wcmsId;
    if (numberOfComments !== undefined) {
      url += "/" + numberOfComments;
    }

    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * Gets the number of Comments / Likes for the given Section.
	 */
  this.getAggregatedSomDataForSection = function(
    pageShortId,
    sectionRefName,
    onSuccess,
    onError,
    numberOfComments,
    timeout
  ) {
    var url = "/section/page/" + pageShortId + "/section/" + sectionRefName;
    if (numberOfComments !== undefined) {
      url += "/" + numberOfComments;
    }

    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * Adds a Like from the current User to a given page.
	 */
  this.addLikeForPage = function(pageShortId, onSuccess, onError, timeout) {
    var url = "/like/page/" + pageShortId;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
    invalidateCache(getMyLikeForPageCacheKey(pageShortId));
    invalidateCache(getMyLikesForPageCacheKey(pageShortId));
  };

  /*
	 * Adds a Like from the current User to a given section.
	 */
  this.addLikeForSection = function(
    pageShortId,
    sectionRefName,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/like/page/" + pageShortId + "/section/" + sectionRefName;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
    invalidateCache(getMyLikeForSectionCacheKey(pageShortId, sectionRefName));
    invalidateCache(getMyLikesForPageCacheKey(pageShortId));
  };

  /*
	 * Adds a Like from the current User to a given record.
	 */
  this.addLikeForRecord = function(wcmsId, onSuccess, onError, timeout) {
    var url = "/like/record/" + wcmsId;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
    invalidateCache(getMyLikeForRecordCacheKey(wcmsId));
  };

  /*
	 * Adds a Like from the current User to a given comment.
	 */
  this.addLikeForComment = function(commentId, onSuccess, onError, timeout) {
    var url = "/like/comment/" + commentId;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Gets a Like from the current User to a given Page (if available).
	 */
  this.getLikeForPage = function(pageShortId, onSuccess, onError, timeout) {
    var likeForPageCacheKey = getMyLikeForPageCacheKey(pageShortId);
    if (isCached(likeForPageCacheKey) && !isBZO) {
      callback(onSuccess, loadFromCache(likeForPageCacheKey));
    } else {
      var url = "/like/page/" + pageShortId;
      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToSoM(
        request,
        function(likeForPageResponse) {
          cache(likeForPageCacheKey, likeForPageResponse);
          callback(onSuccess, likeForPageResponse);
        },
        onError
      );
    }
  };

  /**
   * Get all Likes from the given page
   *
   * @author Marcel Liebgott <external.marcel.liebgott@de.bosch.com>
   */
  this.getLikesForPage = function(
    pageShortId,
    onSuccess,
    onError,
    offset,
    pageSize,
    timeout
  ) {
    var useCache = false;
    var likesForPageCacheKey = getLikesForPageCacheKey(pageShortId);
    likesForPageCacheKey = likesForPageCacheKey + offset + pageSize;

    if (useCache && isCached(likesForPageCacheKey) && !isBZO) {
      callback(onSuccess, loadFromCache(likesForPageCacheKey));
    } else {
      var url = "/like/page/likes/" + pageShortId;

      if (offset !== undefined && pageSize !== undefined) {
        url += "/" + offset + "/" + pageSize;
      }

      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToSoM(
        request,
        function(likesForPageResponse) {
          cache(likesForPageCacheKey, likesForPageResponse);
          callback(onSuccess, likesForPageResponse);
        },
        onError,
        userManager.injectUserProfilesAsCommentActors
      );
    }
  };

  /**
   * return all likers from the given section
   *
   * @author Marcel Liebgott <external.marcel.liebgott@de.bosch.com>
   */
  this.getLikesForSection = function(
    pageShortId,
    sectionRefName,
    onSuccess,
    onError,
    offset,
    pageSize,
    timeout
  ) {
    var useCache = false;
    var likesForSectionCacheKey = getLikesForSectionCacheKey(pageShortId);
    likesForSectionCacheKey = likesForSectionCacheKey + offset + pageSize;

    if (useCache && isCached(likesForSectionCacheKey) && !isBZO) {
      callback(onSuccess, loadFromCache(likesForSectionCacheKey));
    } else {
      var url =
        "/like/page/likes/" + pageShortId + "/section/" + sectionRefName;

      if (offset !== undefined && pageSize !== undefined) {
        url += "/" + offset + "/" + pageSize;
      }

      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToSoM(
        request,
        function(likesForSectionResponse) {
          cache(likesForSectionCacheKey, likesForSectionResponse);
          callback(onSuccess, likesForSectionResponse);
        },
        onError,
        userManager.injectUserProfilesAsCommentActors
      );
    }
  };

  /**
   * @author Marcel Liebgott <external.marcel.liebgott@de.bosch.com>
   *
   * Gets all likes from a record
   */
  this.getLikesForRecord = function(
    wcmsId,
    onSuccess,
    onError,
    offset,
    pageSize,
    timeout
  ) {
    var useCache = false;
    var likesForRecordCacheKey = getLikesForRecordCacheKey(wcmsId);
    likesForRecordCacheKey = likesForRecordCacheKey + offset + pageSize;

    if (useCache && isCached(likesForRecordCacheKey) && !isBZO) {
      callback(onSuccess, loadFromCache(likesForRecordsCacheKey));
    } else {
      var url = "/like/record/likes/" + wcmsId;

      if (offset !== undefined && pageSize !== undefined) {
        url += "/" + offset + "/" + pageSize;
      }

      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToSoM(
        request,
        function(likesForRecordResponse) {
          cache(likesForRecordCacheKey, likesForRecordResponse);
          callback(onSuccess, likesForRecordResponse);
        },
        onError,
        userManager.injectUserProfilesAsCommentActors
      );
    }
  };

  /*
	 * Gets a Like from the current User to a given Section (if available).
	 */
  this.getLikeForSection = function(
    pageShortId,
    sectionRefName,
    onSuccess,
    onError,
    timeout
  ) {
    var likeForSectionCacheKey = getMyLikeForSectionCacheKey(
      pageShortId,
      sectionRefName
    );
    if (isCached(likeForSectionCacheKey) && !isBZO) {
      callback(onSuccess, loadFromCache(likeForSectionCacheKey));
    } else {
      var url = "/like/page/" + pageShortId + "/section/" + sectionRefName;
      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToSoM(
        request,
        function(likeForSectionResponse) {
          cache(likeForSectionCacheKey, likeForSectionResponse);
          callback(onSuccess, likeForSectionResponse);
        },
        onError
      );
    }
  };

  /*
	 * Gets a Like from the current User to a given Record (if available).
	 */
  this.getLikeForRecord = function(wcmsId, onSuccess, onError, timeout) {
    var likeForRecordCacheKey = getMyLikeForRecordCacheKey(wcmsId);
    if (isCached(likeForRecordCacheKey) && !isBZO) {
      callback(onSuccess, loadFromCache(likeForRecordCacheKey));
    } else {
      var url = "/like/record/" + wcmsId;
      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToSoM(
        request,
        function(likeForRecordResponse) {
          cache(likeForRecordCacheKey, likeForRecordResponse);
          callback(onSuccess, likeForRecordResponse);
        },
        onError,
        userManager.injectUserProfilesAsCommentActors
      );
    }
  };

  function removeLike(likeId, onSuccess, onError, timeout) {
    var url = "/like/remove/" + likeId;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  }

  /*
	 * Removes a Like for a Page.
	 */
  this.removeLikeForPage = function(
    pageShortId,
    likeId,
    onSuccess,
    onError,
    timeout
  ) {
    removeLike(likeId, onSuccess, onError, timeout);
    invalidateCache(getMyLikeForPageCacheKey(pageShortId));
    invalidateCache(getMyLikesForPageCacheKey(pageShortId));
  };

  /*
	 * Removes a Like for a Section.
	 */
  this.removeLikeForSection = function(
    pageShortId,
    sectionRefName,
    likeId,
    onSuccess,
    onError,
    timeout
  ) {
    removeLike(likeId, onSuccess, onError, timeout);
    invalidateCache(getMyLikeForSectionCacheKey(pageShortId, sectionRefName));
    invalidateCache(getMyLikesForPageCacheKey(pageShortId));
  };

  /*
	 * Removes a Like for a Record.
	 */
  this.removeLikeForRecord = function(
    wcmsId,
    likeId,
    onSuccess,
    onError,
    timeout
  ) {
    removeLike(likeId, onSuccess, onError, timeout);
    invalidateCache(getMyLikeForRecordCacheKey(wcmsId));
  };

  /*
	 * Removes a Like for a comment.
	 */
  this.removeLikeForComment = function(
    commentId,
    likeId,
    onSuccess,
    onError,
    timeout
  ) {
    removeLike(likeId, onSuccess, onError, timeout);
  };

  /*
	 * Adds a Comment from the current User to a given Page.
	 */
  this.addCommentForPage = function(
    pageShortId,
    text,
    bcActivityStreamId,
    sendNotification,
    pageUrl,
    title,
    owner,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/comment/page/" + pageShortId;

    if (sendNotification === false) {
      pageUrl = "null";
      owner = "null";
      title = "null";
    }
    url =
      url + "/" + encodeURIComponent(owner) + "/" + encodeURIComponent(title);
    url =
      url +
      "/" +
      encodeURIComponent(encodeURIComponent(pageUrl)) +
      "/" +
      sendNotification;
    url = url + "/" + encodeURIComponent(bcActivityStreamId);

    var request = new Request("POST", url);
    request.dataType = "text/plain";
    request.timeout = getTimeout(timeout);
    request.data = text;

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Adds a Comment from the current User to a given Section.
	 */
  this.addCommentForSection = function(
    pageShortId,
    sectionRefName,
    text,
    bcActivityStreamId,
    sendNotification,
    pageUrl,
    title,
    owner,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/comment/page/" + pageShortId + "/section/" + sectionRefName;

    if (sendNotification === false) {
      pageUrl = "null";
      owner = "null";
      title = "null";
    }
    url =
      url + "/" + encodeURIComponent(owner) + "/" + encodeURIComponent(title);
    url =
      url +
      "/" +
      encodeURIComponent(encodeURIComponent(pageUrl)) +
      "/" +
      sendNotification;
    url = url + "/" + encodeURIComponent(bcActivityStreamId);

    var request = new Request("POST", url);
    request.dataType = "text/plain";
    request.timeout = getTimeout(timeout);
    request.data = text;

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Adds a Comment from the current User to a given Record.
	 */
  this.addCommentForRecord = function(
    wcmsId,
    text,
    bcActivityStreamId,
    sendNotification,
    pageUrl,
    title,
    owner,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/comment/record/" + wcmsId;

    if (sendNotification === false) {
      pageUrl = "null";
      owner = "null";
      title = "null";
    }
    url =
      url + "/" + encodeURIComponent(owner) + "/" + encodeURIComponent(title);
    url =
      url +
      "/" +
      encodeURIComponent(encodeURIComponent(pageUrl)) +
      "/" +
      sendNotification;
    url = url + "/" + encodeURIComponent(bcActivityStreamId);

    var request = new Request("POST", url);
    request.dataType = "text/plain";
    request.timeout = getTimeout(timeout);
    request.data = text;

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Removes a Comment from the current User.
	 */
  this.removeComment = function(commentId, onSuccess, onError, timeout) {
    this.removeCommentWithReason(
      commentId,
      "",
      "",
      "",
      onSuccess,
      onError,
      timeout
    );
  };

  /*
	 * Removes a Comment from the current User.
	 */
  this.removeCommentWithReason = function(
    commentId,
    reason,
    link,
    title,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/comment/remove/" + commentId;

    if (link !== undefined && link.length > 0) {
      url = url + "?link=" + encodeURIComponent(encodeURIComponent(link));
      if (title !== undefined && title.length > 0) {
        url = url + "&title=" + encodeURIComponent(title);
      }
    }

    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);
    if (reason !== undefined && reason !== null && reason.length > 0) {
      request.dataType = "text/plain";
      request.data = reason;
    }

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Gets the Comments for a given Page with pagination.
	 */
  this.getCommentsForPage = function(
    pageShortId,
    orderKey,
    onSuccess,
    onError,
    offset,
    pageSize,
    timeout
  ) {
    var url = "/comment/page/" + pageShortId;
    if (offset !== undefined && pageSize !== undefined) {
      url += "/" + offset + "/" + pageSize;
    }
    url += "?orderBy=" + orderKey;

    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * Gets the Comments for a given Section with pagination.
	 */
  this.getCommentsForSection = function(
    pageShortId,
    sectionRefName,
    orderKey,
    onSuccess,
    onError,
    offset,
    pageSize,
    timeout
  ) {
    var url = "/comment/page/" + pageShortId + "/section/" + sectionRefName;
    if (offset !== undefined && pageSize !== undefined) {
      url += "/" + offset + "/" + pageSize;
    }
    url += "?orderBy=" + orderKey;

    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * Gets the Comments for a given Record with pagination.
	 */
  this.getCommentsForRecord = function(
    wcmsId,
    orderKey,
    onSuccess,
    onError,
    offset,
    pageSize,
    timeout
  ) {
    var url = "/comment/record/" + wcmsId;
    if (offset !== undefined && pageSize !== undefined) {
      url += "/" + offset + "/" + pageSize;
    }
    url += "?orderBy=" + orderKey;

    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * Adds a share from the current User to a given Page.
	 */
  this.addShareForPage = function(pageShortId, onSuccess, onError, timeout) {
    var url = "/share/page/" + pageShortId;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Adds a share from the current User to a given Section.
	 */
  this.addShareForSection = function(
    pageShortId,
    sectionRefName,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/share/page/" + pageShortId + "/section/" + sectionRefName;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Adds a share from the current User to a given Record.
	 */
  this.addShareForRecord = function(wcmsId, onSuccess, onError, timeout) {
    var url = "/share/record/" + wcmsId;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  };

  /*
	 * Gets the acceptance state of the general terms and conditions.
	 */
  this.getAcceptedGTC = function(onSuccess, onError, timeout) {
    var acceptedGtcCacheKey = "bgn.som.me.acceptedGTC";
    if (isCached(acceptedGtcCacheKey)) {
      callback(onSuccess, loadFromCache(acceptedGtcCacheKey));
    } else {
      var url = "/user/me/acceptedGTC";
      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);
      postMessageManager.postMessageToSoM(
        request,
        function(acceptedGtcResponse) {
          cache(acceptedGtcCacheKey, acceptedGtcResponse);
          callback(onSuccess, acceptedGtcResponse);
        },
        onError
      );
    }
  };

  /*
	 * Sets the acceptance state of the general terms and conditions.
	 */
  this.setAcceptedGTC = function(accepted, onSuccess, onError, timeout) {
    var acceptedGtcCacheKey = "bgn.som.me.acceptedGTC";
    var url = "/user/me/acceptedGTC/" + accepted;
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(
      request,
      function(acceptedGTCResponse) {
        callback(onSuccess, acceptedGTCResponse);
        invalidateCache(acceptedGtcCacheKey);
      },
      onError
    );
  };

  /*
	 * Gets the BoschConnect Profile of the current User (based on user's NT-ID)
	 */
  this.getMyUserProfile = function(onSuccess, onError) {
    userManager.getOwnUserProfile(onSuccess, onError);
  };

  /*
	 * Gets the current Users NT-ID.
	 */
  this.getMyUserId = function(onSuccess, onError, timeout) {
    userManager.getMySoMUserId(onSuccess, onError, timeout);
  };

  /*
	 * Gets the most liked elements
	 */
  this.getMostLiked = function(
    getPages,
    getSections,
    getRecords,
    offset,
    pageSize,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/statistics/most/liked";
    mostElements(
      url,
      getPages,
      getSections,
      getRecords,
      offset,
      pageSize,
      onSuccess,
      onError,
      timeout
    );
  };

  /*
	 * Gets the most shared elements
	 */
  this.getMostShared = function(
    getPages,
    getSections,
    getRecords,
    offset,
    pageSize,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/statistics/most/shared";
    mostElements(
      url,
      getPages,
      getSections,
      getRecords,
      offset,
      pageSize,
      onSuccess,
      onError,
      timeout
    );
  };

  /*
	 * Gets the most commented elements
	 */
  this.getMostCommented = function(
    getPages,
    getSections,
    getRecords,
    offset,
    pageSize,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/statistics/most/commented";
    mostElements(
      url,
      getPages,
      getSections,
      getRecords,
      offset,
      pageSize,
      onSuccess,
      onError,
      timeout
    );
  };

  function mostElements(
    url,
    getPages,
    getSections,
    getRecords,
    offset,
    pageSize,
    onSuccess,
    onError,
    timeout
  ) {
    if (getPages === true) {
      url += "/" + true;
    } else {
      url += "/" + false;
    }

    if (getSections === true) {
      url += "/" + true;
    } else {
      url += "/" + false;
    }

    if (getRecords === true) {
      url += "/" + true;
    } else {
      url += "/" + false;
    }

    url = url + "/" + offset + "/" + pageSize;

    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToSoM(request, onSuccess, onError);
  }

  /*
	 * Get all Bosch Connect Followers of the current user.
	 * 
	 * Success: returns an array with all followers of the current user.
	 * Error: returns httpStatus 404 when the user profile of the current user could not be found.
	 */
  this.getMyBCFollowers = function(onSuccess, onError, timeout) {
    userManager.getMyBCFollowers(onSuccess, onError, timeout);
  };

  /**
   * Get BoCo users by a search String
   */
  this.searchForBoschConnectProfle = function(
    searchString,
    count,
    onSuccess,
    onError,
    timeout
  ) {
    if (count === null) {
      count = 5;
    }
    var url =
      "/search/basic/people/typeahead?query=" +
      searchString +
      "&pageSize=" +
      count +
      "&highlight=false&boostFriends=true";
    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToBC(request, onSuccess, onError);
  };

  /*
	 * Post a message on the Bosch Connect ActivityStream of the current user.
	 * 
	 * Success: returns httpStatus of Bosch Connect response.
	 * Error: returns httpStatus of Bosch Connect response.
	 */
  this.postOnMyBoard = function(
    title,
    message,
    objectUrl,
    objectId,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/connections/opensocial/rest/activitystreams/@public/@all";
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);
    request.dataType = "application/json; charset=UTF-8";

    var requestBody = {};
    requestBody.actor = {};
    requestBody.actor.id = "@me";
    requestBody.verb = "post";
    requestBody.title = title;
    requestBody.content = message;
    requestBody.object = {};
    requestBody.object.objectType = "note";
    requestBody.object.id = objectId;
    requestBody.object.url = validateUrl(objectUrl);
    requestBody.generator = {};
    // requestBody.generator.image = {"url": "https://connect.bosch.com/boschconnect/thirdparty/bgnSocialMedia/bgn_connect_icon.png"};
    requestBody.generator.image = {
      url:
        "https://connect.bosch.com/boschconnect/iframebridge.htmlboschconnect/thirdparty/bgnSocialMedia/bgn_connect_icon.png"
    };
    requestBody.generator.id = "bgn";
    requestBody.generator.displayName = "Bosch GlobalNet";

    request.data = jQuery.toJSON(requestBody);

    postMessageManager.postMessageToBC(
      request,
      function(responseStatus, response) {
        var successResponse = {};
        successResponse.httpStatus = responseStatus;
        successResponse.response = response;
        callback(onSuccess, successResponse);
      },
      function(responseStatus) {
        var errorResponse = {};
        errorResponse.httpStatus = responseStatus;
        callback(onError, errorResponse);
      }
    );
  };

  /*
	 * Post a message on a followers board (in Bosch Connect) of the current user. 
	 * 
	 * Success: returns httpStatus of Bosch Connect response.
	 * Error: returns httpStatus of Bosch Connect response.
	 */
  this.postOnFollowerBoard = function(
    bcProfileUserId,
    message,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/connections/opensocial/rest/ublog/" + bcProfileUserId + "/@all";
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);
    request.dataType = "application/json; charset=UTF-8";
    request.data = '{"content":"' + parseNewLine(message) + '"}';

    postMessageManager.postMessageToBC(
      request,
      function(responseStatus) {
        var successResponse = {};
        successResponse.httpStatus = responseStatus;
        callback(onSuccess, successResponse);
      },
      function(responseStatus) {
        var errorResponse = {};
        errorResponse.httpStatus = responseStatus;
        callback(onError, errorResponse);
      }
    );
  };

  /*
	 * Retrieve an amount of communities for current user
	 */
  this.getMyCommunitiesByOpenSocialApi = function(
    filterValue,
    count,
    onSuccess,
    onError,
    timeout
  ) {
    var filter = "&filterValue=" + filterValue;
    if (filterValue === null) {
      filter = "";
    }
    if (count === null) {
      count = 5;
    }
    var url =
      "/communities/service/opensocial/groups/@me?count=" + count + filter;
    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToBC(request, onSuccess, onError);
  };

  /*
	*	Get all memeber of a specific community by name
	*/
  this.getCommunityMembers = function(
    communityBcId,
    onSuccess,
    onError,
    timeout
  ) {
    var url =
      "/communities/service/atom/forms/community/members?lite=true&communityUuid=" +
      communityBcId +
      "&format=full";
    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToBC(request, onSuccess, onError);
  };

  /*
	*	Get community infos, e.g. like blogs etc.
	*/
  this.getCommunityInformation = function(
    communityBcId,
    onSuccess,
    onError,
    timeout
  ) {
    var url =
      "/communities/service/atom/community/widgets?communityUuid=" +
      communityBcId;
    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);

    postMessageManager.postMessageToBC(request, onSuccess, onError);
  };

  /*
	*	Provides information wheather a user is allowed to post updates to community board
	*/
  this.getCommunityUpdatesInformation = function(
    communityBcId,
    onSuccess,
    onError,
    timeout
  ) {
    var cacheKey = "bgn.som.community.board.infos." + communityBcId;
    if (isCached(cacheKey)) {
      onSuccess(200, loadFromCache(cacheKey));
    } else {
      var url =
        "/news/sharebox/config.action?type=local&resourceType=community&resourceId=" +
        communityBcId;
      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToBC(
        request,
        function(status, response) {
          cache(cacheKey, response);
          onSuccess(status, response);
        },
        onError
      );
    }
  };

  /*
	*	Provides information wheather a user is allowed to post a blog comment
	*/
  this.getCommunityBlogInformation = function(
    communityBcId,
    onSuccess,
    onError,
    timeout
  ) {
    var cacheKey = "bgn.som.community.blog.infos." + communityBcId;
    var errorCacheKey = "bgn.som.community.blog.infos.error." + communityBcId;

    if (isCached(cacheKey)) {
      callback(onSuccess, loadFromCache(cacheKey));
    } else if (isCached(errorCacheKey)) {
      onError(403, loadFromCache(cacheKey));
    } else {
      var url = "/blogs/" + communityBcId;

      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);

      postMessageManager.postMessageToBC(
        request,
        function(status, response) {
          if (status === 200) {
            url =
              "/blogs/roller-ui/authoring/weblog.do?method=create&weblog=" +
              communityBcId;
            request = new Request("GET", url);
            request.timeout = getTimeout(timeout);

            postMessageManager.postMessageToBC(
              request,
              function(status, response) {
                cache(cacheKey, response);
                callback(onSuccess, response);
              },
              function(error) {
                cache(errorCacheKey, "");
                onError(error);
              }
            );
          } else {
            cache(errorCacheKey, response);
          }
        },
        function(error) {
          cache(errorCacheKey, "");
          onError(error);
        }
      );
    }
  };

  /*
	 * Post a message to a community
	 * 
	 */
  this.postToCommunity = function(
    bcCommunityId,
    message,
    onSuccess,
    onError,
    timeout
  ) {
    var url =
      "/connections/opensocial/rest/ublog/urn:lsid:lconn.ibm.com:communities.community:" +
      bcCommunityId +
      "/@all";
    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);
    request.dataType = "application/json; charset=UTF-8";
    request.data = '{"content":"' + parseNewLine(message) + '"}';

    postMessageManager.postMessageToBC(request, onSuccess, onError);
  };

  /*
	 * Post a blog entry to a community
	 * 
	 */
  this.postToCommunityBlog = function(
    bcCommunityId,
    objectUrl,
    title,
    message,
    onSuccess,
    onError,
    timeout
  ) {
    var url = "/blogs/" + bcCommunityId + "/api/entries";
    var atomXml =
      "<?xml version='1.0' encoding='utf-8'?>" +
      "<entry xmlns='http://www.w3.org/2005/Atom'>" +
      "<title type='text'>" +
      title +
      "</title>" +
      "<content type='html'>" +
      "<![CDATA[ " +
      urlify(message.replace("\n", "<br />"), objectUrl) +
      "]]>" +
      "</content>" +
      "</entry>";
    log("Sending: ");
    log(atomXml);

    var request = new Request("POST", url);
    request.timeout = getTimeout(timeout);
    request.dataType = "application/atom+xml";
    request.data = atomXml;

    postMessageManager.postMessageToBC(request, onSuccess, onError);
  };

  /*
	 * Get last blog entries of a community
	 * 
	 */
  this.getLastCommunityBlogPosts = function(
    communityUuid,
    numberOfPosts,
    onSuccess,
    onError,
    timeout
  ) {
    var url =
      "/blogs/roller-ui/rendering/feed_form/" +
      communityUuid +
      "/entries/atom?ps=" +
      numberOfPosts +
      "&page=0&sortby=0&order=desc";
    // possible additional params:
    //&cache=false&fromCommunity=true&lang=en_us&user=1B6C2F1D-7333-4D2D-A548-43EB5E943D68&isMember=true
    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);
    postMessageManager.postMessageToBC(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * Get last forum entries of a community
	 * 
	 */
  this.getLastCommunityForumPosts = function(
    communityUuid,
    numberOfPosts,
    onSuccess,
    onError,
    timeout
  ) {
    var url =
      "/forums/atom/forms/topics?overview=true&communityUuid=" +
      communityUuid +
      "&sortOrder=desc&ps=" +
      numberOfPosts +
      "&display=topics";
    var request = new Request("GET", url);
    request.timeout = getTimeout(timeout);
    postMessageManager.postMessageToBC(
      request,
      onSuccess,
      onError,
      userManager.injectUserProfilesAsCommentActors
    );
  };

  /*
	 * JSON requires new line characters be escaped.
	 */
  function parseNewLine(text) {
    text = text.replace("\r\n", "\n");
    text = text.replace("\r", "\n");

    text = text.replace(new RegExp("(\n[ ]*)"), "\\n");
    return text;
  }

  /*
	*	Helper to detect links within html
	*/
  function urlify(text, url) {
    return text.replace(url, function(u) {
      return '<a href="' + u + '">' + u + "</a>";
    });
  }
}
/*
 * Manages the processing state of tasks.
 */
function TaskManager() {
  var taskStorage = {};
  var responseManager;

  /*
	 * Sets the ResponseManager.
	 */
  this.setResponseManager = function(value) {
    responseManager = value;
  };

  /*
	 * Creates a new task.
	 */
  this.createTask = function(outstanding, responseToken) {
    return new BackgroundTask(outstanding, responseToken);
  };

  /*
	 * Registers a task in the manager.
	 */
  this.registerTask = function(token, task) {
    taskStorage[token] = task;
  };

  /*
	 * Marks a single sub-task of this task as finished.
	 * If all outstanding sub-tasks are finished the onSuccess-callback of the task will be executed.
	 */
  this.proceed = function(token) {
    var task = taskStorage[token];

    if (--task.outstanding == 0) {
      // all outstanding steps are done -> call service callback method and finish this task
      finishTask(task);
      delete taskStorage[token];
    }
  };

  /*
	 * Aborts the given task.
	 */
  this.abort = function(token) {
    delete taskStorage[token];
  };

  /*
	 * Checks if a given task is still active.
	 */
  this.isActive = function(token) {
    if (taskStorage[token] === undefined) {
      return false;
    }
    return true;
  };

  /*
	 * Finishes a task if all sub-tasks are finished and executes the onSucces-callback of the task.
	 */
  var finishTask = function(task) {
    var tokenResponse = responseManager.get(task.responseToken);

    if (tokenResponse.response === undefined) {
      callback(tokenResponse.onSuccess);
    } else {
      callback(tokenResponse.onSuccess, tokenResponse.response);
    }
    responseManager.finish(task.responseToken);
  };

  /*
 	* Represents a task which is managed by a TaskManager.
 	* A BackgroundTask consits of multiple sub-task which are executed independent and asynchronous.
 	* If a asynchronous sub-task is done it can be marked as finished by the TaskManager.
 	*
	* @attribute 'outstanding' (required) - Number of sub-tasks which needs to be proceed before the whole task can marked as finished.
 	* @attribute 'responseToken' (required) - Token of the ResponseToken to which the BackgroundTask belongs to.
 	*/
  function BackgroundTask(outstanding, responseToken) {
    this.outstanding = outstanding;
    this.responseToken = responseToken;
  }
}
/*
The UserManager is responsible for all actions that invoke retrieving user profiles (SoM / Bosch Connect).
*/
function UserManager(postMessageManager, taskManager, responseManager) {
  this.postMessageManager = postMessageManager;
  this.taskManager = taskManager;
  this.responseManager = responseManager;
  var context = this;

  /*
     * Gets the current SoM user.
     */
  this.getMySoMUserId = function(onSuccess, onError, timeout) {
    var myProfileCacheKey = "bgn.som.me.profile";
    if (isCached(myProfileCacheKey)) {
      callback(onSuccess, loadFromCache(myProfileCacheKey));
    } else {
      var url = "/user/me";
      var request = new Request("GET", url);
      request.timeout = getTimeout(timeout);
      postMessageManager.postMessageToSoM(
        request,
        function(myUserProfileResponse) {
          cache(myProfileCacheKey, myUserProfileResponse);
          callback(onSuccess, myUserProfileResponse);
        },
        onError
      );
    }
  };

  /*
	 * Searches for the Bosch Connect user data of the current user.
	 *
	 * @attribute 'onSucces' (required) - Success callback method when the user was found and could be created.
	 * @attribute 'onError' (required) - Error callback method when the user was NOT found or could NOT be created.
	 *
	 * error if: bad HTTP status of getMySoMUserId OR bad HTTP status of searchBCUserForEmail OR no BC Profile found for own email
	 */
  this.getOwnUserProfile = function(onSuccess, onError) {
    context.getMySoMUserId(
      function(response) {
        if (
          typeof response === "undefined" ||
          !response.hasOwnProperty("email")
        ) {
          var error = {
            title: "Invalid BC User Profile",
            text: "BC user is undefined or does not have an email"
          };
          onError(error);
          return;
        }

        var email = response.email;

        if (isCached(email)) {
          var cachedUser = loadFromCache(email);
          onSuccess(cachedUser);
        } else {
          searchBCUserForEmail(
            email,
            function(status, BCresponse, token) {
              var user = extractUserDataFromBCResponse(BCresponse);

              if (user !== null) {
                cache(user.email, user);
                onSuccess(user);
              } else {
                onError();
              }
            },
            function() {
              onError();
            }
          );
        }
      },
      function(eventualTimeoutResponse) {
        onError(eventualTimeoutResponse);
      }
    );
  };

  /*
	 * Takes a response and injects UserProfile information as comment actors.
	 * If a user cannot be found in Bosch Connect there will be no UserProfile information injected for this user!
	 *
	 * @attribute 'responseToken' (required) - The token of the TokenResponse in which context this method should be executed. 
	 */
  this.injectUserProfilesAsCommentActors = function(responseToken) {
    var tokenResponse = responseManager.get(responseToken);

    try {
      tokenResponse.response = jQuery.parseJSON(tokenResponse.response);
    } catch (e) {
      // no further action can be performed
      return callback(tokenResponse.onError);
    }

    var unrefinedResponse = tokenResponse.response;
    var onSuccess = tokenResponse.onSuccess;
    var onError = tokenResponse.onError;

    var response = unrefinedResponse;

    /*
		 * Assumption: the "comments" attribute of the response contains all comments.
		 * But if no "comments" attribute is available, the response are the comments itself.
		 */
    var comments;
    if (response.hasOwnProperty("comments")) {
      comments = response.comments;
    } else {
      comments = response;
    }

    var mailSet = {};
    for (var index = 0; index < comments.length; ++index) {
      var email = comments[index].actor.email;
      mailSet[email] = null; // value of this property is never used; only keys are used as Set
    }

    // number of users that needs to be injected as comment actors
    var outstanding = getNumberOfOwnProperties(mailSet);

    // if no user profiles needs to be injected stop further progress and callback onSuccess with origin response
    if (outstanding === 0) {
      return callback(onSuccess, response);
    }

    var taskToken = getToken();
    tokenResponse.taskToken = taskToken;
    var backgroundTask = taskManager.createTask(outstanding, responseToken);
    taskManager.registerTask(taskToken, backgroundTask);

    // request for user data of each commenting actor of the page
    for (var email in mailSet) {
      if (mailSet.hasOwnProperty(email)) {
        if (isCached(email)) {
          var cachedUser = loadFromCache(email);
          injectUserProfile(tokenResponse.response, cachedUser);
          if (taskManager.isActive(taskToken)) {
            taskManager.proceed(taskToken);
          }
        } else {
          // request Bosch Connect for user profile information
          var url = "/profiles/atom/profile.do?email=" + email;

          var request = new Request("GET", url);
          request.timeout = getTimeout();
          // combinded token (1st part: taskManager token, 2nd part: for handling the succes/error of the postMessage for this function itself)
          request.token = taskToken + "-" + request.token; // combined token

          postMessageManager.postMessageToBC(
            request,
            function(status, response, combinedToken) {
              var taskToken = combinedToken.split("-")[0];

              if (taskManager.isActive(taskToken)) {
                var user = extractUserDataFromBCResponse(response);

                // if user should be null -> no actor information to inject
                if (user !== null) {
                  injectUserProfile(tokenResponse.response, user);
                  cache(user.email.toLowerCase(), user);
                }
                taskManager.proceed(taskToken);
              }
            },
            function(status, response, combinedToken) {
              if (taskManager.isActive(taskToken)) {
                // TODO: nicht gefunden, weil Status ??? + injizieren
                taskManager.proceed(taskToken); // nothing to inject. actor information stays the same as in the origin response
              }
            },
            true
          );
        }
      }
    }
  };

  /*
	 * Takes a Bosch Connect response (search user profile by email) and extracts the relevant user data.
	 * @attribute 'BCresponse' (required) - Bosch Connect response
	 * @return - the extracted user data or null if no user was found in the BCresponse
	 */
  function extractUserDataFromBCResponse(BCresponse) {
    var responseXML = jQuery.parseXML(BCresponse);
    var entry = jQuery(responseXML)
      .find("entry")
      .first();
    if (entry == undefined || entry == null || entry.length < 1) {
      return null;
    }
    var name = entry
      .find("contributor")
      .find("name")
      .text();
    var email = entry
      .find("contributor")
      .find("email")
      .text();
    var photo = entry.find("link[type='image']").attr("href");
    var link = entry.find("link[rel='related']").attr("href");
    var bcProfileKey = link.split("key=")[1];
    var bcProfileUserId = entry
      .find("contributor")
      .find("snx\\:userid")
      .text();
    var state = entry
      .find("contributor")
      .find("snx\\:userState")
      .text();
    var user = new UserProfile(
      name,
      email,
      link,
      photo,
      bcProfileKey,
      bcProfileUserId
    );
    user.state = state;

    return user;
  }

  /*
	 * Injects user profile information in data of a BackgroundTask.
	 * @attribute 'response' (required) - Response object in which the user should be injected.
	 * @attribute 'userProfile' (required) - The UserProfile.
	 */
  function injectUserProfile(response, userProfile) {
    /*
		 * Assumption: the "comments" attribute of the response contains all comments.
		 * But ff no "comments" attribute is available, the response are the comments itself.
		 */
    var comments;
    if (response.hasOwnProperty("comments")) {
      comments = response.comments;
    } else {
      comments = response;
    }

    for (var index = 0; index < comments.length; ++index) {
      var email = comments[index].actor.email;

      if (email.toLowerCase() === userProfile.email.toLowerCase()) {
        comments[index].actor = jQuery.extend(
          {},
          comments[index].actor,
          userProfile
        );
      }
    }
  }

  /*
	 * Searches a Bosch Connect user for a given email.
	 *
	 * @attribute 'email' (required) - email of the user.
	 * @attribute 'onSuccess' (required) - Success callback method when the user was found.
	 * @attribute 'onError' (required) - Error callback method when the user was NOT found.
	 */
  function searchBCUserForEmail(email, onSuccess, onError) {
    var url = "/profiles/atom/profile.do?email=" + email;
    var request = new Request("GET", url);
    request.timeout = getTimeout();

    postMessageManager.postMessageToBC(request, onSuccess, onError, true);
  }

  /*
	 * Gets all BC friends of the current user.
	 * call stack: getMyBCFollowers -> getOwnUserProfile(-> getMySoMUserId) -> searchBCUserForEmail -> onSuccess
	 *
	 * error if: error during getOwnUserProfile OR bad HTTP status for BC follower request
	 */
  this.getMyBCFollowers = function(onSuccess, onError, timeout) {
    context.getOwnUserProfile(
      function(response) {
        var user = response;
        var key = user.bcProfileKey;

        var url =
          "/profiles/atom2/forms/viewallfriends.xml?key=" +
          key +
          "&pageSize=1500";
        var request = new Request("GET", url);
        request.timeout = getTimeout(timeout);

        postMessageManager.postMessageToBC(
          request,
          function(status, followerXmlResponse) {
            var followerUserProfiles = extractFollowerFromBCResponse(
              followerXmlResponse
            );

            callback(onSuccess, followerUserProfiles);
          },
          function(status) {
            var errorResponse = {};
            errorResponse.httpStatus = status;
            callback(onError, errorResponse);
          }
        );
      },
      function(eventualTimeoutResponse) {
        if (eventualTimeoutResponse !== undefined) {
          callback(onError, eventualTimeoutResponse);
        } else {
          var errorResponse = {};
          errorResponse.httpStatus = 400;
          callback(onError, errorResponse);
        }
      }
    );
  };

  /*
	 * Takes a Bosch Connect response (get my followers) and extracts the relevant follower data.
	 * @attribute 'BCresponse' (required) - Bosch Connect response
	 * @return - the extracted follower data
	 */
  function extractFollowerFromBCResponse(followerXmlResponse) {
    var followersXML = jQuery.parseXML(followerXmlResponse);
    var followers = jQuery(followersXML).find("atom\\:entry");
    var followerUserProfiles = [];

    followers.each(function() {
      var name = jQuery(this)
        .find("atom\\:title")
        .text();
      var email = jQuery(this).attr("snx:email");
      var link = jQuery(this)
        .find("atom\\:link")
        .attr("href");
      var photo = jQuery(this).attr("snx:imageUrl");
      var bcProfileKey = jQuery(this).attr("snx:key");
      var bcProfileUserId = jQuery(this).attr("snx:userid");

      var user = new UserProfile(
        name,
        email,
        link,
        photo,
        bcProfileKey,
        bcProfileUserId
      );
      followerUserProfiles.push(user);
    });

    return followerUserProfiles;
  }

  /*
	 * Represents a Bosch Connect User Profile including all relevant user data.
	 */
  function UserProfile(
    name,
    email,
    link,
    photo,
    bcProfileKey,
    bcProfileUserId
  ) {
    this.name = name;
    this.email = email;
    this.link = link;
    this.photo = photo;
    this.bcProfileKey = bcProfileKey;
    this.bcProfileUserId = bcProfileUserId;
  }
}
var DEFAULT_CACHE_LIFETIME = "3600000";
var DEFAULT_REQUEST_TIMEOUT = "18000";

/*
 * Generates an unique token.
 */
function getToken() {
  return (
    new Date().getTime().toString() +
    Math.random()
      .toString()
      .substring(5)
  );
}

/*
 * Gets a valid timeout. If the given value is valid
 * timeout value return it again else return a default timeout value.
 */

function getTimeout(timeout) {
  if (timeout !== undefined && typeof timeout === "number") {
    return timeout;
  } else {
    return DEFAULT_REQUEST_TIMEOUT;
  }
}

/*
 * Trims the url and checks if it starts with a valid protocol.
 * If not it just adds http:// in front of the url.
 *
 * @return - the validated url
 */
function validateUrl(url) {
  var http = "http://";
  var https = "https://";

  var validatedUrl = jQuery.trim(url);
  if (validatedUrl.indexOf(http) !== 0 && validatedUrl.indexOf(https) !== 0) {
    validatedUrl = http + validatedUrl;
  }
  return validatedUrl;
}

/*
 * Utility method which returns the number of own properties of an object.
 *
 * @return - the number of OWN properties of the given object.
 */
function getNumberOfOwnProperties(object) {
  var length = 0;

  if (!Object.keys) {
    // fix for IE < 9
    for (var prop in object) {
      if (object.hasOwnProperty(prop)) length++;
    }
  } else {
    length = Object.keys(object).length;
  }
  return length;
}

/*
 * Checks if a value for a given key is stored in the Local Storage.
 * The key is case insensitive.
 *
 * @return - true if a value for the given key exists in the Local Storage, else false.
 */
function isCached(key) {
  var value = jQuery.jStorage.get(key.toLowerCase());
  return value !== null;
}

/*
 * Stores a key/value pair in the Local Storage.
 * The key is case insensitive.
 */
function cache(key, value) {
  jQuery.jStorage.set(key.toLowerCase(), value, {
    TTL: DEFAULT_CACHE_LIFETIME
  });
}

/*
 * Loads a value for the given key from the Local Storage.
 * The key is case insensitive.
 *
 * @return - the value or null if no value exists for the given key.
 */
function loadFromCache(key) {
  return jQuery.jStorage.get(key.toLowerCase());
}

/*
 * Deletes the value for the given key from the Local Storage.
 * The key is case insensitive.
 */
function invalidateCache(key) {
  if (isCached(key.toLowerCase())) {
    jQuery.jStorage.deleteKey(key.toLowerCase());
  }
}

/*
 * Generates the cache keys under which certain values are stored in the Local Storage.
 */

/**
 * @author Marcel Liebgott <external.marcel.liebgott@de.bosch.com>
 */
function getLikesForPageCacheKey(pageShortId) {
  return "bgn.som.page.likes-" + pageShortId;
}

/**
 * @author Marcel Liebgott <external.marcel.liebgott@de.bosch.com>
 */
function getLikesForSectionCacheKey(pageShortId, sectionRefName) {
  return "bgn.som.me.likes.section-" + pageShortId + "_" + sectionRefName;
}

/**
 * @author Marcel Liebgott <external.marcel.liebgott@de.bosch.com>
 */
function getLikesForRecordCacheKey(wcmsId) {
  return "bgn.som.me.likes.records-" + wcmsId;
}

function getMyLikesForPageCacheKey(pageShortId) {
  return "bgn.som.me.likes-" + pageShortId;
}

function getMyLikeForPageCacheKey(pageShortId) {
  return "bgn.som.me.like.page-" + pageShortId;
}

function getMyLikeForSectionCacheKey(pageShortId, sectionRefName) {
  return "bgn.som.me.like.section-" + pageShortId + "_" + sectionRefName;
}

function getMyLikeForRecordCacheKey(wcmsId) {
  return "bgn.som.me.like.record-" + wcmsId;
}

/*
 * Executes a given callback method.
 * If this method is called with a second parameter this will be uses a method parameter for the callback method.
 * Else the callback method will be executed without additional parameter.
 *
 * @attribute 'callbackMethod' (required) - The callback method.
 * @attribute 'callbackMethodParameter' (optional) - An additional parameter for the callback method.
 */
function callback(callbackMethod, callbackMethodParameter) {
  if (callbackMethodParameter === undefined) {
    callbackMethod();
  } else {
    if (typeof callbackMethodParameter === "string") {
      try {
        // JSON string -> object
        callbackMethodParameter = jQuery.parseJSON(callbackMethodParameter);
      } catch (e) {
        // callback without emptyparameter
        return callbackMethod("{}");
      }
    }
    callbackMethod(callbackMethodParameter);
  }
}

/*
 * Writes some unformatted text in the console of the browser.
 * If the console is not available, nothing will be logged.
 */
function log(text) {
  if (typeof console !== "undefined") {
    console.log(text);
  }
}

function logError(text) {
  if (typeof console !== "undefined") {
    console.error(text);
  }
}

/*
 * A simple request representation.
 */
function Request(method, url) {
  this.token = getToken();
  this.method = method;
  this.url = url;
}

/*
 * Extract url parameter from given url
 * returns value of given param or empty string
 */
function getUrlParameterByName(parameterName, url) {
  if (typeof url === "undefined") return "";

  var urlParams = url.split("?");

  if (urlParams.length < 1) return "";

  var urlVariables = urlParams[1].split("&");
  for (var i = 0; i < urlVariables.length; i++) {
    var param = urlVariables[i].split("=");
    if (param[0] == parameterName) {
      return param[1];
    }
  }
  return "";
}
