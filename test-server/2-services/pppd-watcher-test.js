var _ = require('lodash');
var fs = require('fs');
var test = require('../test');
var PppdWatcher = require(process.cwd() + '/services/pppd-watcher');

describe('PppdWatcher',function(){

    var helpers = require(process.cwd() + '/lib/hash-helpers');
    var hashkeys = require(process.cwd() + '/lib/config-hashkeys');
    var ppp = helpers.hash2config({},hashkeys.PPP);

    beforeEach(function() {
        test.mockery.enable();
        test.mockery.registerMock('shelljs',test.mockshelljs);
        test.mockshelljs.reset();
        test.mockery.warnOnUnregistered(false);
    });

    afterEach(function() {
        test.mockery.deregisterMock('shelljs');
        test.mockery.disable();
        test.mockshelljs.snapshot().should.eql([]);
        test.pp.snapshot().should.eql([]);
    });

    it('should be immediately stopped',function(done){
        var watcher = new PppdWatcher().start(ppp);
        watcher.ready().should.not.be.ok;
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[pppd      ] start watching',
            '[pppd      ] pppstats error: Error: no response found: pppstats',
            '[pppd      ] stop watching']);
        test.mockshelljs.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if start called twice',function(done){
        var count = 0;
        var watcher = new PppdWatcher()
            .on('note',function(){ count++; })
            .start(ppp);
        count.should.equal(1);
        test.expect(function(){ watcher.start(ppp); }).to.throw('already started');
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[pppd      ] start watching',
            '[pppd      ] pppstats error: Error: no response found: pppstats',
            '[pppd      ] stop watching']);
        test.mockshelljs.snapshot().should.eql([]);
        done();
    });

    it('should throw an error if stopped before started',function(done){
        var watcher = new PppdWatcher();
        test.expect(function(){ watcher.stop(); }).to.throw('not started');
        test.pp.snapshot().should.eql([]);
        test.mockshelljs.snapshot().should.eql([]);
        done();
    });

    it('should start pppd if it is not found',function(done){
        test.mockshelljs.lookup['pppstats'] = [1,"pppstats: nonexistent interface 'ppp0' specified"];
        test.mockshelljs.lookup['pppd']     = [0,''];

        var watcher = new PppdWatcher().start(function(event){
            event.should.equal('pppd');
        });
        watcher.ready().should.not.be.ok;
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[pppd      ] start watching',
            '[pppd      ] starting pppd',
            '[pppd      ] stop watching']);
        test.mockshelljs.snapshot(); // clear snapshot
        done();
    });

    it('should add ppp route if it is not found',function(done){
        test.mockshelljs.lookup['pppstats'] = [0,'IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ'];
        test.mockshelljs.lookup['route -n'] = [0,fs.readFileSync('test-server/data/route-no-ppp.txt').toString()];
        test.mockshelljs.lookup['route add -net 172.29.12.0 netmask 255.255.255.0 dev ppp0'] = [0,''];

        var watcher = new PppdWatcher()
            .on('note',function(event){ event.should.equal('route'); })
            .start(ppp);
        watcher.ready().should.be.ok;
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[pppd      ] start watching',
            '[pppd      ] add ppp route to GWaaS',
            '[pppd      ] stop watching']);
        test.mockshelljs.snapshot(); // clear snapshot
        done();
    });

    it('should detect an existing ppp route and do nothing',function(done){
        test.mockshelljs.lookup['pppstats'] = [0,'IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ'];
        test.mockshelljs.lookup['route -n'] = [0,fs.readFileSync('test-server/data/route-includes-ppp.txt').toString()];

        var watcher = new PppdWatcher()
            .on('note',function(event){ event.should.equal('ready'); })
            .start(ppp);
        watcher.ready().should.be.ok;
        watcher.stop();
        test.pp.snapshot().should.eql([
            '[pppd      ] start watching',
            '[pppd      ] stop watching']);
        test.mockshelljs.snapshot(); // clear snapshot
        done();
    });

    it('should detect failed response from route',function(done){
        test.mockshelljs.lookup['pppstats'] = [0,'IN   PACK VJCOMP  VJUNC  VJERR  |      OUT   PACK VJCOMP  VJUNC NON-VJ'];
        test.mockshelljs.lookup['route -n'] = [1,null];

        var watcher = new PppdWatcher();
        watcher.on('note',function(event){
            event.should.eql('error');
            watcher.ready().should.not.be.ok;
            test.pp.snapshot().should.eql([]);
            test.mockshelljs.snapshot(); // clear snapshot
            done();
        });
        watcher.checkRoutes();
    });

    it('should check routes at intervals',function(done){
        var count = 0;
        var watcher = new PppdWatcher().on('note',function(){
            if (count++ > 0) {
                watcher.ready().should.not.be.ok;
                watcher.stop();
                test.pp.snapshot().should.eql([
                    '[pppd      ] start watching',
                    '[pppd      ] pppstats error: Error: no response found: pppstats',
                    '[pppd      ] pppstats error: Error: no response found: pppstats',
                    '[pppd      ] stop watching']);
                test.mockshelljs.snapshot().should.eql([]);
                done();
            }
        }).start(_.defaults({routeInterval: 1},ppp));
    });

    it('should allow caching of shell responses',function() {
        var count = 0;
        var watcher = new PppdWatcher();

        test.mockshelljs.lookup['test'] = [0,'first'];
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([null,'first']);
            count++;
        });

        test.mockshelljs.lookup['test'] = [0,'second'];
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([null,'second']);
            count++;
        });

        test.mockshelljs.lookup['test'] = [0,'third'];
        watcher.getShellOutput('test','test',false,function(err,output) {
            [err,output].should.eql([null,'second']);
            count++;
        });

        count.should.equal(3);
        test.pp.snapshot().should.eql([]);
        test.mockshelljs.snapshot(); // clear snapshot
    });

    it('should detect unexpected responses for pppstats',function(done){
        var watcher = new PppdWatcher();

        test.mockshelljs.lookup['pppstats'] = [0,'unexpected'];
        watcher.on('note',function(event){
            event.should.eql('error');
            test.pp.snapshot().should.eql(['[pppd      ] unexpected pppstats output: unexpected']);
            test.mockshelljs.snapshot(); // clear snapshot
            done();
        });
        watcher.checkRoutes();
    });

    it('should detect failed shell responses',function(done){
        test.mockshelljs.lookup['test'] = [1,'first'];

        var watcher = new PppdWatcher();
        watcher.getShellOutput('test','test',true,function(err,output) {
            [err,output].should.eql([1,'first']);
            test.pp.snapshot().should.eql([]);
            test.mockshelljs.snapshot(); // clear snapshot
            done();
        });
    });
});