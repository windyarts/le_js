/**
 * @license Copyright 2013 Logentries.
 * Please view license at https://raw.github.com/logentries/le_js/master/LICENSE
 */

/*jslint browser:true*/
/*global define, module, exports, console, global, JSON, unescape */

/** @param {Object} window */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(function() {
            return factory(root);
        });
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        if (typeof global === 'object') {
            // Browserify. The calling object `this` does not reference window.
            // `global` and `this` are equivalent in Node, preferring global
            // adds support for Browserify.
            root = global;
        }
        module.exports = factory(root);
    } else {
        // Browser globals (root is window)
        root.TT = factory(root);
    }
}(this, function(window) {
    "use strict";

    /**
     * A single log event stream.
     * @constructor
     * @param {Object} options
     */
    function LogStream(options) {
        /** @type {string} */
        var _token = options.token;
        /** @type {string} */
        var _secret = options.secret;
        /** @type {boolean} */
        var _print = options.print;
        /** @type {string} */
        var _build = options.build;
        /** @type {string} */
        var _userId = options.userId;
        /** @type {string} */
        var _userName = options.userName;
        /** @type {string} */
        var _sessionId = options.sessionId;
        /** @type {string} */
        var _device = options.device;

        if (_device === null || typeof _device === 'undefined') {
            _device = 'Browser: ' + window.navigator.userAgent;
        }

        /**
         * @type {string} */
        var _endpoint;
        if (window.TTENDPOINT) {
            _endpoint = window.TTENDPOINT;
        } else {
            _endpoint = "api.traintracks.io/v1/events";
        }

        /**
         * Flag to prevent further invocations on network err
         ** @type {boolean} */
        var _shouldCall = true;
        /** @type {boolean} */
        var _SSL = function() {
            if (typeof XDomainRequest === "undefined") {
                return options.ssl;
            }
            // If we're relying on XDomainRequest, we
            // must adhere to the page's encryption scheme.
            return window.location.protocol === "https:" ? true : false;
        }();
        /** @type {Array.<string>} */
        var _backlog = [];
        /** @type {boolean} */
        var _active = false;
        /** @type {boolean} */
        var _sentPageInfo = false;

        var _agentInfo = function() {
            var nav = window.navigator || {doNotTrack: undefined};
            var screen = window.screen || {};
            var location = window.location || {};

            return {
              url: location.pathname,
              referrer: document.referrer,
              screen: {
                width: screen.width,
                height: screen.height
              },
              window: {
                width: window.innerWidth,
                height: window.innerHeight
              },
              browser: {
                name: nav.appName,
                version: nav.appVersion,
                cookie_enabled: nav.cookieEnabled,
                do_not_track: nav.doNotTrack
              },
              platform: nav.platform
            };
        };

        var _warn = function() {
            try {
                console.warn.apply(console, arguments);
            } catch (ex) {
                console.log.apply(console, arguments);
            }
        };

        // Single arg stops the compiler arity warning
        var _rawLog = function(eventType, event) {
            if (!arguments.length) {
                throw new Error("No arguments!");
            }
            
            if (!eventType || typeof eventType !== 'string') {
                throw new Error('Event type is required and should be string');
            }

            var data = {
                clientTimestamp: toUTCTimestamp(new Date()),
                device: _device,
                userId: _userId,
                userName: _userName,
                sessionId: _sessionId,
                build: _build,
                eventType: eventType,
                data: event
            };

            return {level: function(l) {
                if (_print && typeof console !== "undefined" && l !== 'PAGE') {
                  try {
                    console[l.toLowerCase()].call(console, data);
                  } catch (ex) {
                    // IE compat fix
                    console.log(data);
                  }
                }

                return {send: function() {
                    if (!(typeof data.data === 'object' && !(data.data instanceof Array) && data.data !== null)) {
                        _warn(eventType + ' won\'t be sent since event is not an object');
                        return;
                    }

                    var cache = [];
                    var serialized = JSON.stringify(data, function(key, value) {
                        // cross-browser indexOf fix
                        var _indexOf = function(array, obj) {
                            for (var i = 0; i < array.length; i++) {
                                if (obj === array[i]) {
                                    return i;
                                }
                            }
                            return -1;
                        };

                        if (typeof value === "undefined") {
                            return "undefined";
                        } else if (typeof value === "object" && value !== null) {
                            if (_indexOf(cache, value) !== -1) {
                              // We've seen this object before;
                              // return a placeholder instead to prevent
                              // cycles
                              return "<?>";
                            }
                            cache.push(value);
                        }
                        return value;
                    });

                    if (_active) {
                        _backlog.push(serialized);
                    } else {
                        _apiCall(_token, _secret, '[' + serialized + ']');
                    }
                }};
            }};
        };

        /** @expose */
        this.log = _rawLog;

        var _apiCall = function(token, secret, data) {
            _active = true;

            // Obtain a browser-specific XHR object
            var _getAjaxObject = function() {
              if (typeof XDomainRequest !== "undefined") {
                // We're using IE8/9
                return new XDomainRequest();
              }
              return new XMLHttpRequest();
            };

            var request = _getAjaxObject();

            if (_shouldCall) {
                if (request.constructor === XMLHttpRequest) {
                    // Currently we don't support fine-grained error
                    // handling in older versions of IE
                    request.onreadystatechange = function() {
                    if (request.readyState === 4) {
                        // Handle any errors
                        if (request.status >= 400) {
                            console.error("Couldn't submit events.");
                            if (request.status === 410) {
                                // This API version has been phased out
                                console.warn("This version of le_js is no longer supported!");
                            }
                        } else {
                            if (request.status === 301) {
                                // Server issued a deprecation warning
                                console.warn("This version of le_js is deprecated! Consider upgrading.");
                            }
                            if (_backlog.length > 0) {
                                // Submit the next event in the backlog
                                _apiCall(token, secret, '[' + _backlog.join(',') + ']');
                                _backlog = [];
                            } else {
                                _active = false;
                            }
                        }
                    }

                    };
                } else {
                  request.onload = function() {
                    if (_backlog.length > 0) {
                      // Submit the next event in the backlog
                      _apiCall(token, secret, '[' + _backlog.join(',') + ']');
                      _backlog = [];
                    } else {
                      _active = false;
                    }
                  };
                }

                var uri = (_SSL ? "https://" : "http://") + _endpoint;
                request.open("POST", uri, true);
                if (request.constructor === XMLHttpRequest) {
                    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                    request.setRequestHeader('Content-type', 'application/json;charset=utf-8');
                    request.setRequestHeader('X-Product-Key', token);
                    request.setRequestHeader('X-Product-Auth', md5(data + secret));
                }
                request.send(data);
            }
        };
    }

    /**
     * A single log object
     * @constructor
     * @param {Object} options
     */
    function Logger(options) {
        var logger;

        // Default values
        var dict = {
            ssl: false,
            print: false,
            endpoint: null,
            token: null,
            secret: null,
            userId: null,
            userName: null,
            sessionId: null,
            build: null,
            device: null
        };

        function toString(value, key) {
            if ((typeof value === 'string' && value.length) || typeof value === 'number') {
                return value.toString(); 
            } else {
                throw new Error(key + ' is required and should be a string');
            }
        }

        var requiredKeys = {
            token: toString,
            secret: toString,
            userId: toString,
            userName: toString,
            sessionId: toString,
            build: toString
        };

        var k;
        
        if (typeof options === "object") {
            for (k in options) {
                dict[k] = options[k];
            }
        } else {
            throw new Error("Invalid parameters for createLogStream()");
        }

        for (k in requiredKeys) {
            dict[k] = requiredKeys[k](dict[k], k);
        }

        logger = new LogStream(dict);

        var _log = function(msg) {
            if (logger) {
                return logger.log.apply(this, arguments);
            } else
                throw new Error("You must call TT.init(...) first.");
        };

         // The public interface
        return {
            log: function() {
                _log.apply(this, arguments).level('LOG').send();
            }
        };
    }

    // Array of Logger elements
    var loggers = {};

    var _getLogger = function(name) {
        if (!loggers.hasOwnProperty(name))
           throw new Error("Invalid name for logStream");

        return loggers[name];
    };

    var  _createLogStream = function(options) {
        if (typeof options.name !== "string")
            throw new Error("Name not present.");
        else if (loggers.hasOwnProperty(options.name))
            throw new Error("A logger with that name already exists!");
        loggers[options.name] = new Logger(options);

        return true;
    };

    var _deprecatedInit = function(options) {
        var dict = {
            name : "default"
        };

        if (typeof options === "object") {
            for (var k in options) {
                dict[k] = options[k];
            }
        }
        else {
            throw new Error("Invalid parameters for init()");
        }

        return _createLogStream(dict);
    };

    var _destroyLogStream = function(name) {
        if (typeof name === 'undefined'){
            name = 'default';
        }

        delete loggers[name];
    };

    var toUTCTimestamp = (function() {

        function toUTCTimestamp(date) {
            return date.getFullYear() +
                '-' + leftZeroFill(date.getMonth() + 1, 2) +
                '-' + leftZeroFill(date.getDate(), 2) +
                'T' + leftZeroFill(date.getHours(), 2) +
                ':' + leftZeroFill(date.getMinutes(), 2) +
                ':' + leftZeroFill(date.getSeconds(), 2) +
                '.' + leftZeroFill(toInt(date.getMilliseconds() * 1000), 6) +
                ZZ(date);
        }

        function leftZeroFill(number, targetLength, forceSign) {
            var output = '' + Math.abs(number),
                sign = number >= 0;

            while (output.length < targetLength) {
                output = '0' + output;
            }
            return (sign ? (forceSign ? '+' : '') : '-') + output;
        }

        function toInt(argumentForCoercion) {
            var coercedNumber = +argumentForCoercion,
                value = 0;

            if (coercedNumber !== 0 && isFinite(coercedNumber)) {
                if (coercedNumber >= 0) {
                    value = Math.floor(coercedNumber);
                } else {
                    value = Math.ceil(coercedNumber);
                }
            }

            return value;
        }

        function ZZ(date) {
            var a = dateUtcOffset(date),
                b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + ':' + leftZeroFill(toInt(a) % 60, 2);
            }

        function dateUtcOffset(date) {
            // On Firefox.24 Date#getTimezoneOffset returns a floating point.
            // https://github.com/moment/moment/pull/1871
            return -Math.round(date.getTimezoneOffset() / 15) * 15;
        }

        return toUTCTimestamp;
    })();

    

    var md5 = (function () {

        /*
        * Add integers, wrapping at 2^32. This uses 16-bit operations internally
        * to work around bugs in some JS interpreters.
        */
        function safe_add(x, y) {
            var lsw = (x & 0xFFFF) + (y & 0xFFFF),
                msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xFFFF);
        }

        /*
        * Bitwise rotate a 32-bit number to the left.
        */
        function bit_rol(num, cnt) {
            return (num << cnt) | (num >>> (32 - cnt));
        }

        /*
        * These functions implement the four basic operations the algorithm uses.
        */
        function md5_cmn(q, a, b, x, s, t) {
            return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
        }
        function md5_ff(a, b, c, d, x, s, t) {
            return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
        }
        function md5_gg(a, b, c, d, x, s, t) {
            return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
        }
        function md5_hh(a, b, c, d, x, s, t) {
            return md5_cmn(b ^ c ^ d, a, b, x, s, t);
        }
        function md5_ii(a, b, c, d, x, s, t) {
            return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
        }

        /*
        * Calculate the MD5 of an array of little-endian words, and a bit length.
        */
        function binl_md5(x, len) {
            /* append padding */
            x[len >> 5] |= 0x80 << (len % 32);
            x[(((len + 64) >>> 9) << 4) + 14] = len;

            var i, olda, oldb, oldc, oldd,
                a =  1732584193,
                b = -271733879,
                c = -1732584194,
                d =  271733878;

            for (i = 0; i < x.length; i += 16) {
                olda = a;
                oldb = b;
                oldc = c;
                oldd = d;

                a = md5_ff(a, b, c, d, x[i],       7, -680876936);
                d = md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
                c = md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
                b = md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
                a = md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
                d = md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
                c = md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
                b = md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
                a = md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
                d = md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
                c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
                b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
                a = md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
                d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
                c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
                b = md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

                a = md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
                d = md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
                c = md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
                b = md5_gg(b, c, d, a, x[i],      20, -373897302);
                a = md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
                d = md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
                c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
                b = md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
                a = md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
                d = md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
                c = md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
                b = md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
                a = md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
                d = md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
                c = md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
                b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

                a = md5_hh(a, b, c, d, x[i +  5],  4, -378558);
                d = md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
                c = md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
                b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
                a = md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
                d = md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
                c = md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
                b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
                a = md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
                d = md5_hh(d, a, b, c, x[i],      11, -358537222);
                c = md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
                b = md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
                a = md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
                d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
                c = md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
                b = md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

                a = md5_ii(a, b, c, d, x[i],       6, -198630844);
                d = md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
                c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
                b = md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
                a = md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
                d = md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
                c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
                b = md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
                a = md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
                d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
                c = md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
                b = md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
                a = md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
                d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
                c = md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
                b = md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

                a = safe_add(a, olda);
                b = safe_add(b, oldb);
                c = safe_add(c, oldc);
                d = safe_add(d, oldd);
            }
            return [a, b, c, d];
        }

        /*
        * Convert an array of little-endian words to a string
        */
        function binl2rstr(input) {
            var i,
                output = '';
            for (i = 0; i < input.length * 32; i += 8) {
                output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
            }
            return output;
        }

        /*
        * Convert a raw string to an array of little-endian words
        * Characters >255 have their high-byte silently ignored.
        */
        function rstr2binl(input) {
            var i,
                output = [];
            output[(input.length >> 2) - 1] = undefined;
            for (i = 0; i < output.length; i += 1) {
                output[i] = 0;
            }
            for (i = 0; i < input.length * 8; i += 8) {
                output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
            }
            return output;
        }

        /*
        * Calculate the MD5 of a raw string
        */
        function rstr_md5(s) {
            return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
        }

        /*
        * Calculate the HMAC-MD5, of a key and some data (raw strings)
        */
        function rstr_hmac_md5(key, data) {
            var i,
                bkey = rstr2binl(key),
                ipad = [],
                opad = [],
                hash;
            ipad[15] = opad[15] = undefined;
            if (bkey.length > 16) {
                bkey = binl_md5(bkey, key.length * 8);
            }
            for (i = 0; i < 16; i += 1) {
                ipad[i] = bkey[i] ^ 0x36363636;
                opad[i] = bkey[i] ^ 0x5C5C5C5C;
            }
            hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
            return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
        }

        /*
        * Convert a raw string to a hex string
        */
        function rstr2hex(input) {
            var hex_tab = '0123456789abcdef',
                output = '',
                x,
                i;
            for (i = 0; i < input.length; i += 1) {
                x = input.charCodeAt(i);
                output += hex_tab.charAt((x >>> 4) & 0x0F) +
                    hex_tab.charAt(x & 0x0F);
            }
            return output;
        }

        /*
        * Encode a string as utf-8
        */
        function str2rstr_utf8(input) {
            return unescape(encodeURIComponent(input));
        }

        /*
        * Take string arguments and return either raw or hex encoded strings
        */
        function raw_md5(s) {
            return rstr_md5(str2rstr_utf8(s));
        }
        function hex_md5(s) {
            return rstr2hex(raw_md5(s));
        }
        function raw_hmac_md5(k, d) {
            return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d));
        }
        function hex_hmac_md5(k, d) {
            return rstr2hex(raw_hmac_md5(k, d));
        }

        function md5(string, key, raw) {
            if (!key) {
                if (!raw) {
                    return hex_md5(string);
                }
                return raw_md5(string);
            }
            if (!raw) {
                return hex_hmac_md5(key, string);
            }
            return raw_hmac_md5(key, string);
        }

        return md5;
    }());

    // The public interface
    return {
        init: _deprecatedInit,
        createLogStream: _createLogStream,
        to: _getLogger,
        destroy: _destroyLogStream,
        log: function() {
            for (var k in loggers)
                loggers[k].log.apply(this, arguments);
        }
    };
}));
