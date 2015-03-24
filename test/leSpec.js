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

// describe('sending user agent data', function(){
//     beforeEach(mockXMLHttpRequests);
//     beforeEach(addGetJson);

//     function checkAgentInfo(agent){
//         expect(agent).toBeDefined();

//         // Perhaps these could be filled in since we're running in a
//         // real browser now?
//         expect(agent.url)     .toBeDefined();
//         expect(agent.referrer).toBeDefined();
//         expect(agent.screen)  .toBeDefined();
//         expect(agent.window)  .toBeDefined();
//         expect(agent.browser) .toBeDefined();
//         expect(agent.platform).toBeDefined();
//     }

//     it('page_info: never - never sends log data', function(){
//         LE.init({token: TOKEN, page_info: 'never'});

//         LE.log('hi');

//         var data = this.getXhrJson(0);

//         expect(data.data).toBe('hi');
//         expect(this.getXhrJson(0).agent).toBeUndefined();
//     });

//     it('page_info: per-entry - sends log data for each log', function(){
//         LE.init({token: TOKEN, page_info: 'per-entry'});

//         LE.log('hi');

//         // Check data is sent the first time
//         checkAgentInfo(this.getXhrJson(0).data);

//         // Respond to first request so that the 2nd request will be made
//         this.requestList[0].respond();

//         expect(this.getXhrJson(1).data).toBe('hi');

//         LE.log('hi again');
//         this.requestList[1].respond();

//         // Check that page info is sent subsequent times
//         checkAgentInfo(this.getXhrJson(2).data);

//         this.requestList[2].respond();

//         expect(this.getXhrJson(3).data).toBe('hi again');
//     });

//     it('page_info: per-page - always sends data for each log', function(){
//         LE.init({token: TOKEN, page_info: 'per-page'});

//         LE.log('hi');

//         // Check data is sent the first time
//         checkAgentInfo(this.getXhrJson(0).data);

//         // Respond to first request so that the 2nd request will be made
//         this.requestList[0].respond();

//         expect(this.getXhrJson(1).data).toBe('hi');

//         LE.log('hi again');
//         this.requestList[1].respond();

//         // Check that no data is sent subsequent times
//         expect(this.getXhrJson(2).data).toBe('hi again');
//     });

//     afterEach(destroy);
// });

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
