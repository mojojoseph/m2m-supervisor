var _ = require('lodash');
var util = require('util');

var Watcher = require('../lib/watcher');

var logger = require('../lib/logger')('route');

function RouteWatcher(config) {
    Watcher.apply(this,[logger,config]);
    this.routeInterval = (config || {}).routeInterval || 15.1000;
    this.outputs = {};
    this.shell = require('shelljs');    // NOTE - delay 'require' for mocking
}

util.inherits(RouteWatcher,Watcher);

RouteWatcher.prototype.started = function(){
    return !!this.interval;
};

RouteWatcher.prototype._onStart = function(ppp) {
    var self = this;
    self.ppp = ppp;
    self.checkRoutes();
    self.interval = setInterval(function(){ self.checkRoutes(); },self.routeInterval);
};

RouteWatcher.prototype._onStop = function() {
    clearInterval(this.interval);
};

RouteWatcher.prototype.checkReady = function(){}; // NOTE - no need for checking ready

RouteWatcher.prototype.checkRoutes = function(){
    var self = this;
    self.pppstatsOutput(true,function(err,pppstatsOutput){
        if (err) {
            if (err == 1 && pppstatsOutput.indexOf('nonexistent interface') >= 0) {   // EXAMPLE: pppstats: nonexistent interface 'ppp0' specified
                logger.info('starting pppd');
                self.shell.exec('pppd');
                self.emit('note','pppd');
            } else {
                logger.error('pppstats error: ' + err);
                self.emit('note','error');
            }
        } else if (pppstatsOutput.indexOf('PACK VJCOMP  VJUNC') < 0){   // EXAMPLE: IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ
            logger.error('unexpected pppstats output: ' + pppstatsOutput);
            self.emit('note','error');
        } else {
            self.routeOutput(true,function(err,routeOutput){
                if (err) {
                    self.emit('note','error');
                } else if (routeOutput.indexOf(self.ppp.subnet) >= 0) {
                    self.emit('note','ready');
                    self.emit('ready');
                } else {
                    logger.info('add ppp route to GWaaS');
                    self.shell.exec('route add -net ' + self.ppp.subnet + ' netmask ' + self.ppp.mask + ' dev ' + self.ppp.interface);
                    self.emit('note','route');
                }
            });
        }
    });
};

RouteWatcher.prototype.pppstatsOutput = function(refresh,callback){
    this.getShellOutput('pppstats','pppstats',refresh,callback);
};

RouteWatcher.prototype.routeOutput = function(refresh,callback){
    this.getShellOutput('route','route -n',refresh,callback);
};

RouteWatcher.prototype.getShellOutput = function(key,command,refresh,callback){
    var self = this;
    if (refresh) self.outputs[key] = null;

    if (self.outputs[key])
        callback(null,self.outputs[key]);
    else
        try {
            self.shell.exec(command,{silent: true},function(code,output) {
                if (code === 0)
                    callback(null,self.outputs[key] = output);
                else
                    callback(code,output);
            });
        } catch(e) {
            callback(e,null);
        }
};

module.exports = RouteWatcher;
