var test = require('../test');
var ConfigCheckpoint = require(process.cwd() + '/services/config-checkpoint');

var schema = require(process.cwd() + '/lib/redis-schema');
var hashkeys = require(process.cwd() + '/lib/config-hashkeys');
var helpers = require(process.cwd() + '/lib/hash-helpers');

describe('ConfigCheckpoint',function() {
    
    var redis = null;

    beforeEach(function () {
        test.mockery.enable();
        test.mockery.registerMock('redis', test.mockredis);
        test.mockery.warnOnUnregistered(false);
        test.mockredis.reset();
        redis = test.mockredis.createClient();
        //test.mockery.registerAllowables(['./logger', './statsd-client']);
        //test.pp.snapshot();
    });

    afterEach(function () {
        test.mockery.deregisterMock('redis');
        test.mockery.disable();
        test.mockredis.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should properly initialize data with minimal arguments',function(){
        var checkpoint = new ConfigCheckpoint(redis,schema.config.key);
        checkpoint.hashkeys.should.eql({});
        checkpoint.required.should.eql([]);
        checkpoint.config.should.eql({retryInterval: 5000});
    });

    it('should properly initialize data with all arguments',function(){
        var checkpoint = new ConfigCheckpoint(redis,schema.config.key,{test: {key: 'test-key',type: 'number',default: 1}},['missing'],{retryInterval: 1000,extra: 1});
        checkpoint.hashkeys.should.eql({test: {key: 'test-key',type: 'number',default: 1}});
        checkpoint.required.should.eql(['missing']);
        checkpoint.config.should.eql({retryInterval: 1000,extra: 1});
    });

    it('should retry if no configuration exists and there are any requirements',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = null;

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,schema.config.key,null,['something'],{retryInterval: 10});
        checkpoint.start(function(event,config){
            event.should.eql('retry');
            if (count++ > 0) {
                checkpoint.stop();
                test.pp.snapshot().should.eql([
                    '[cfg-chk   ] start checkpoint',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] stop checkpoint'
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-config'},
                    {hgetall: 'm2m-config'}]);
                done();
            }
        });
    });

    it('should return ready if no configuration exists but also not requirements',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = null;

        var checkpoint = new ConfigCheckpoint(redis,schema.config.key,{test: {key: 'test-key',type: 'number',default: 1}},null);
        checkpoint.start(function(event,config){
            checkpoint.stop();
            event.should.eql('ready');
            config.should.eql({test: 1});
            test.pp.snapshot().should.eql([
                '[cfg-chk   ] start checkpoint',
                '[cfg-chk   ] stop checkpoint'
            ]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-config'}]);
            done();
        });
    });

    it('should retry if redis config does not meet requirements',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = {found: '1',other: '2'};

        var count = 0;
        var checkpoint = new ConfigCheckpoint(redis,schema.config.key,null,['found','missing'],{retryInterval: 10});
        checkpoint.start(function(event,config){
            event.should.eql('retry');
            if (count++ > 0) {
                checkpoint.stop();
                test.pp.snapshot().should.eql([
                    '[cfg-chk   ] start checkpoint',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] not ready',
                    '[cfg-chk   ] stop checkpoint'
                ]);
                test.mockredis.snapshot().should.eql([
                    {hgetall: 'm2m-config'},
                    {hgetall: 'm2m-config'}]);
                done();
            }
        });
    });

    it('should return ready if redis config meets requirements',function(done){
        test.mockredis.lookup.hgetall['m2m-config'] = {
            'gateway:imei': '123456789012345',
            'gateway:private-host': 'private-host',
            'gateway:private-port': '1234',
            'gateway:public-host': 'public-host',
            'gateway:public-port': '5678'};

        var requirements = helpers.requirements(hashkeys.gateway);
        requirements.should.eql(['gateway:imei']);

        var checkpoint = new ConfigCheckpoint(redis,schema.config.key,hashkeys.gateway,requirements);
        checkpoint.start(function(event,config){
            checkpoint.stop();
            event.should.eql('ready');
            config.should.eql({
                imei: '123456789012345',
                primary: 'public',
                privateHost: 'private-host',
                privatePort: 1234,
                privateRelay: 4000,
                publicHost: 'public-host',
                publicPort: 5678,
                publicRelay: 4001
            });
            test.pp.snapshot().should.eql([
                '[cfg-chk   ] start checkpoint',
                '[cfg-chk   ] stop checkpoint'
            ]);
            test.mockredis.snapshot().should.eql([
                {hgetall: 'm2m-config'}]);
            done();
        });
    });

    it('should throw an error if start called twice',function(done){
        var checkpoint = new ConfigCheckpoint(redis,schema.config.key);
        checkpoint.start();
        test.expect(function(){ checkpoint.start(); }).to.throw('already started');
        checkpoint.stop();
        test.pp.snapshot().should.eql([
            '[cfg-chk   ] start checkpoint',
            '[cfg-chk   ] stop checkpoint'
        ]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var checkpoint = new ConfigCheckpoint(redis,schema.config.key);
        test.expect(function(){ checkpoint.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockredis.snapshot().should.eql([]);
        done();
    });

});