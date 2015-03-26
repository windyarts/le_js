/*jslint loopfunc:true*/
/*globals describe, it, expect, LE, sinon, afterEach, beforeEach, jasmine, window, JSON, md5*/
var GLOBAL = this;
var TOKEN = 'test_token';
var initConfig = {
    token: TOKEN,
    userId: 'test',
    userName: 'tester',
    build: '1.2',
    sessionId: 'session-test'
};

function destroy(){
    LE.destroy('default');
    LE.destroy(TOKEN);
}
function mockXMLHttpRequests(){
    // Prevent requests
    this.xhr = sinon.useFakeXMLHttpRequest();

    // List requests
    var requestList = this.requestList = [];

    this.xhr.onCreate = function(request){
        requestList.push(request);
    };
}
function addGetJson(){
    this.getXhrJson = function(xhrRequestId) {
        return JSON.parse(this.requestList[xhrRequestId].requestBody);
    };
}
function restoreXMLHttpRequests(){
    if(this.xhr){
        this.xhr.restore();
    }
}


describe('construction', function () {

    it('with object', function () {
        expect(LE.init(initConfig)).toBe(true);
    });

    // TODO: Test Raul's multi logger

    describe('fails', function () {
        it('without options', function () {
            expect(LE.init).toThrow("Invalid parameters for init()");
        });

        it('without token', function () {
            expect(function() {
                LE.init({
                    userId: 'test',
                    userName: 'tester',
                    build: '1.2',
                    sessionId: 'session-test'
                });
            }).toThrow('token is required and should be a string');
        });
    });

    afterEach(destroy);
});

describe('sending headers', function() {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function() {
        LE.init(initConfig);
    });

    it('sends X-Product-Key as header', function() {
        LE.log('hi');

        expect(this.requestList[0].requestHeaders['X-Product-Key']).toBe(TOKEN);
    });

    it('sends X-Product-Auth as header', function() {
        LE.log('hi');

        var request = this.requestList[0];
        var hash = md5(request.requestBody + request.requestHeaders['X-Product-Key']);

        expect(this.requestList[0].requestHeaders['X-Product-Auth']).toBe(hash);
    });

    it('sends Content-type as "application/json;charset=utf-8"', function() {
        LE.log('hi');

        expect(this.requestList[0].requestHeaders['Content-type']).toBe('application/json;charset=utf-8');
    });

    afterEach(destroy);
});

describe('sending common information', function() {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function() {
        LE.init(initConfig);
    });

    it('logs clientTimestamp as format of 2012–03–14T02:33:42.416587+00:00', function() {
        LE.log('hi');

        expect(this.getXhrJson(0).clientTimestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}[+-]\d{2}:\d{2}/);
    });

    it('logs device as format of "Browser: $userAgent$" if not provided', function() {
        LE.log('hi');

        expect(this.getXhrJson(0).device).toMatch(/^Browser: /);
    });

    it('logs build as init options', function() {
        LE.log('hi');
        expect(this.getXhrJson(0).build).toBe('1.2');
    });

    it('logs userId as init options', function() {
        LE.log('hi');
        expect(this.getXhrJson(0).userId).toBe('test');
    });

    it('logs userName as init options', function() {
        LE.log('hi');
        expect(this.getXhrJson(0).userName).toBe('tester');
    });

    it('logs sessionId as init options', function() {
        LE.log('hi');
        expect(this.getXhrJson(0).sessionId).toBe('session-test');
    });    

    afterEach(destroy);
});

describe('sending messages', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function() {
        LE.init(initConfig);
    });

    it('logs clientTimestamp as format of 2012–03–14T02:33:42.416587+00:00', function() {
        LE.log('hi');

        expect(this.getXhrJson(0).clientTimestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}[+-]\d{2}:\d{2}/);
    });

    it('logs device as format of "Browser: $userAgent$"', function() {
        LE.log('hi');

        expect(this.getXhrJson(0).device).toMatch(/^Browser: /);
    });

    it('logs null values', function(){
        LE.log(null);

        expect(this.getXhrJson(0).data).toBe(null);
    });

    it('logs undefined values', function(){
        LE.log(undefined);

        expect(this.getXhrJson(0).data).toBe('undefined');
    });

    it('logs object with nullish properties', function(){
        LE.log({
            undef: undefined,
            nullVal: null
        });

        var event = this.getXhrJson(0).data;
        expect(event.undef).toBe('undefined');
        expect(event.nullVal).toBe(null);
    });

    it('logs array with nullish values', function(){
        LE.log([
            undefined,
            null
        ]);

        var event = this.getXhrJson(0).data;
        expect(event[0]).toBe('undefined');
        expect(event[1]).toBe(null);
    });


    it('accepts multiple arguments', function(){
        var args = ['test', 1, undefined];

        LE.log.apply(LE, args);

        var event = this.getXhrJson(0).data;
        expect(event.length).toBe(3);
        expect(event[0]).toBe(args[0]);
        expect(event[1]).toBe(args[1]);
        expect(event[2]).toBe('undefined');
    });

    afterEach(destroy);
});

describe('sends log level', function(){
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function() {
        LE.init(initConfig);
    });

    var methods = [
        'log'
    ];

    for(var i=0; i<methods.length; i++){
        var method = methods[i];
        var level = method.toUpperCase();

        it(level, function(method, level){
            return function(){
                LE[method]('test');
                expect(this.getXhrJson(0).level).toBe(level);
            };
        }(method, level));
    }

    it('excludes cyclic values', function(){
        var a = {};
        a.b = a;

        LE.log(a);

        expect(this.getXhrJson(0).data.b).toBe('<?>');
    });

    afterEach(restoreXMLHttpRequests);
    afterEach(destroy);
});

describe('destroys log streams', function () {
    it('default', function () {
        LE.init(initConfig);
        LE.destroy();

        expect(function(){
            LE.init(initConfig);
        }).not.toThrow();
    });

    it('custom name', function () {
        var testConfig = {};
        for (var k in initConfig) {
            testConfig[k] = initConfig[k];
        }
        testConfig.name = 'test';

        LE.init(testConfig);
        LE.destroy('test');

        expect(function(){
            LE.init(testConfig);
        }).not.toThrow();
    });

    afterEach(destroy);
});

describe('custom endpoint', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function() {
        window.LEENDPOINT = 'somwhere.com/custom-logging';
        LE.init(initConfig);
    });
    
    it('can be set', function () {
        LE.log('some message');
        var lastReq = this.requestList[1]; //no idea why its sending two messages
        
        expect(lastReq.url).toBe('https://somwhere.com/custom-logging/logs/test_token');
    });
    
    afterEach(restoreXMLHttpRequests);
    afterEach(destroy);
});
