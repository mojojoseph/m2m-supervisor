var _ = require('lodash');

module.exports.chai = require('chai');
module.exports.should = module.exports.chai.should();
module.exports.expect = module.exports.chai.expect;
module.exports.pp = require(process.cwd() + '/lib/bunyan-prettyprinter');
module.exports.mockery = require('mockery');
module.exports.timekeeper = require('timekeeper');

require(process.cwd() + '/lib/logger')('test      ').info('test environment loaded');

module.exports.matchArrays = function(actual,expected){
    actual.length.should.equal(expected.length);
    for(var index = 0; index < actual.length; index++) {
        if (typeof expected[index] === 'string')
            actual[index].should.eql(expected[index]);
        else
            actual[index].should.match(expected[index]);
    }
};

// DRAM -----------------------

module.exports.mockdgram = function() {
    var self = this;
    self.deliveries = [];
    self.createSocket = function(argument) {
        var socket = {
            events: {},
            socketType: argument,
            closed: false,
            address: function() { return {address: 'localhost',port: 1000}; }
        };
        socket.bind = function(port){
            socket.port = port;
        };
        socket.on = function(event,callback) {
            socket.events[event] = callback;
        };
        socket.send = function(data,start,end,port,host) {
            self.deliveries.push([data,start,end,port,host]);
        };
        socket.close = function () {
            socket.closed = true;
        };
        return socket;
    };
};

// LYNX -----------------------

module.exports.mocklynx = function(host,port,options) {
    var mock = {};

    module.exports.mocklynx.options = options;
    module.exports.mocklynx.calls = [];
    
    mock.increment = function(name){
        module.exports.mocklynx.calls.push({increment: name});
    };

    mock.gauge = function(name,value){
        module.exports.mocklynx.calls.push({gauge: name,value: value});
    };

    mock.send = function(object){
        module.exports.mocklynx.calls.push({send: object});
    };
    
    return mock;
};

module.exports.mocklynx.snapshot = function() {
    var result = module.exports.mocklynx.calls;
    module.exports.mocklynx.calls = [];
    return result;
};

// SHELLJS ---------------------

module.exports.mockshelljs = {};

module.exports.mockshelljs.reset = function(){
    module.exports.mockshelljs.lookup = {};
};

module.exports.mockshelljs.exec = function() {
    var command = arguments[0];
    var response = module.exports.mockshelljs.lookup[command];
    if (!response) throw(new Error('no response found: ' + command));

    var lastArgument = arguments[arguments.length - 1];
    switch(typeof lastArgument){
        case 'object':
        case 'string':
            return {output: response};
        case 'function':
            lastArgument(response[0],response[1]);
    }
};

// REDIS ----------------------

function MockRedisClient(){

}

MockRedisClient.prototype.on_error = function (){};

var MockRedis = {calls: [],RedisClient: MockRedisClient};

MockRedis.reset = function(){
    MockRedis.clientException = null;
    MockRedis.lookup = {
        get: {},
        hgetall: {},
        llen: {},
        lpush: {}
    };
    MockRedis.errors = {};
};

MockRedis.snapshot = function(){
    var result = MockRedis.calls;
    MockRedis.calls = [];
    return result;
};

MockRedis.createClient = function () {
    if (MockRedis.clientException) throw(new Error(MockRedis.clientException));
    return {
        get: function(key,callback) {
            MockRedis.calls.push({get: key});
            callback && callback(MockRedis.errors[key] || null,MockRedis.lookup.get[key] || '0');
        },
        hgetall: function(key,callback){
            MockRedis.calls.push({hgetall: key});
            callback && callback(MockRedis.errors[key] || null,MockRedis.lookup.hgetall[key]);
        },
        hmset: function(args,callback){
            MockRedis.calls.push({hmset: args});
            callback && callback(MockRedis.errors[args[0]] || null,0); // TODO what should the return be??
        },
        llen: function(key,callback) {
            MockRedis.calls.push({llen: key});
            callback && callback(MockRedis.errors[key] || null,MockRedis.lookup.llen[key] || '0');
        },
        lpush: function(key,value,callback) {
            MockRedis.calls.push({lpush: [key,value]});
            var list = MockRedis.lookup.lpush[key] = MockRedis.lookup.lpush[key] || [];
            list.unshift(value);
            callback && callback(MockRedis.errors[key] || null,list.length);
        },
        quit: function(){
            MockRedis.calls.push({quit: null});
        },
        mset: function(){
            var arglength = Math.floor(arguments.length / 2) * 2;
            var callback = arguments.length > arglength && arguments[arglength];
            MockRedis.calls.push({mset: _.take(_.toArray(arguments),arglength)});
            callback && callback(MockRedis.errors[key] || null,arglength / 2);
        },
        set: function(key,value,callback){
            MockRedis.calls.push({set: [key,value]});
            callback && callback(MockRedis.errors[key] || null,true);
        }
    }
};

module.exports.mockredis = MockRedis;

// SOCKET.IO ----------------------

var mockSocketIO = {
    httpServer: null,
    calls: []
};

mockSocketIO.on = function(event,callback) {
    mockSocketIO.eventHandlers[event] = callback;
};

mockSocketIO.reset = function(){
    mockSocketIO.httpServer = null;
    mockSocketIO.eventHandlers = {};
    mockSocketIO.sockets = [];
};

mockSocketIO.newMockSocket = function(){
    var mockSocket = {
        socketID: mockSocketIO.sockets.length,
        eventHandlers: {}
    };
    mockSocket.on = function(event,callback){
        mockSocket.eventHandlers[event] = callback;
    };
    mockSocket.emit = function(event,data){
        var args = {socket: mockSocket.socketID};
        args[event] = data;
        mockSocketIO.calls.push({emit: args});
    };
    mockSocketIO.sockets.push(mockSocket);
    return mockSocket;
};

module.exports.mocksocketio = function (httpServer){
    mockSocketIO.reset();
    mockSocketIO.httpServer = httpServer;
    return mockSocketIO;
};

module.exports.mocksocketio.model = mockSocketIO;

module.exports.mocksocketio.reset = function(){
    mockSocketIO.reset();
};

module.exports.mocksocketio.snapshot = function(){
    var calls = mockSocketIO.calls;
    mockSocketIO.calls = [];
    return {
        events: _.keys(mockSocketIO.eventHandlers),
        sockets: _.map(mockSocketIO.sockets,function(socket){
            return {id: socket.socketID,events: _.keys(socket.eventHandlers)};
        }),
        calls: calls
    };
};

process.env.testing = true;

