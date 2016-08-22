/*eslint-env mocha */
/*eslint-disable no-unused-expressions*/
'use strict';

import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {EventEmitter} from 'events';
import mock from 'mock-fs';
import proxyquire from 'proxyquire';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('MicroLDAP', () => {
    describe('constructor()', () => {
        const MicroLDAP = require('../src/MicroLDAP').default;

        it('should throw an Error if no options are passed', () => {
            return expect(() => {
                new MicroLDAP();
            }).to.throw(`options object must be passed`);
        });

        it('should throw an Error if no url is defined in options', () => {
            return expect(() => {
                new MicroLDAP({});
            }).to.throw(`'url' must be included`);
        });

        it('should throw an Error if url is not of ldap(s):// form', () => {
            return expect(() => {
                new MicroLDAP({ url: 'test' });
            }).to.throw(`'url' must be of ldap(s):// form`);
        });

        it('should store passed in url in its own options', () => {
            let testURL = 'ldaps://',
                microldap = new MicroLDAP({ url: testURL });

            return expect(microldap.options).to.have.deep.property('url', testURL);
        });

        it('should set tlsOptions.rejectUnauthorized to be true by default', () => {
            let microldap = new MicroLDAP({ url: 'ldap://' });

            return expect(microldap.options).to.have.deep.property('tlsOptions.rejectUnauthorized', true);
        });

        it('should allow tlsOptions.rejectUnauthorized to be set to false', () => {
            let microldap = new MicroLDAP({ url: 'ldap://', rejectUnauthorized: false });

            return expect(microldap.options).to.have.deep.property('tlsOptions.rejectUnauthorized', false);
        });

        it('should throw an error if ca option does not exist', () => {
            mock({
                '/a/fake/path': {}
            });

            return expect(() => {
                new MicroLDAP({ url: 'ldaps://', ca: '/nonexist' });
            }).to.throw(`'ca' path must exist`);
        });

        it('should throw an error if ca option is not a file', () => {
            mock({
                '/a/fake/path': {}
            });

            return expect(() => {
                new MicroLDAP({ url: 'ldaps://', ca: '/a/fake/path' });
            }).to.throw(`'ca' path must exist`);
        });

        it('should throw an error if ca option is a valid certificate file', () => {
            mock({
                '/a/fake/file': ""
            });

            return expect(() => {
                new MicroLDAP({ url: 'ldaps://', ca: '/a/fake/file' });
            }).to.throw(`File does not contain 'BEGIN CERTIFICATE' or 'END CERTIFICATE'`);
        });

        it('should not throw an error if ca option is a valid file', () => {
            mock({
                '/a/fake/file': "-BEGIN CERTIFICATE-abcd-END CERTIFICATE-"
            });

            return expect(() => {
                new MicroLDAP({ url: 'ldaps://', ca: '/a/fake/file' });
            }).to.not.throw();
        });
    });

    describe('functions', () => {
        let ldapStub,
            MicroLDAP,
            microLDAP,
            microLDAPOpts,
            mockEmitter,
            sandbox;

        function resetEmitter() {
            mockEmitter = new EventEmitter;
            mockEmitter.bind = function () {};
            mockEmitter.destroy = function () {};
            mockEmitter.search = function () {};
        }

        beforeEach(() => {
            ldapStub = {
                createClient: () => { return mockEmitter; }
            };

            MicroLDAP = proxyquire('../src/MicroLDAP', {
                'ldapjs': ldapStub,
            }).default;

            microLDAPOpts = {
                url: "ldaps://"
            };

            microLDAP = new MicroLDAP(microLDAPOpts);
        });

        describe('bind()', () => {
            beforeEach(() => {
                sandbox = sinon.sandbox.create();
                resetEmitter();
            });

            afterEach(() => {
                sandbox.restore();
            });

            it('should return a Promise', () => {
                return expect(microLDAP.bind()).to.be.an.instanceOf(Promise);
            });

            it('should reject if no username is passed', () => {
                return expect(microLDAP.bind()).to.eventually.be.rejectedWith(`'username' option must be passed`);
            });

            it('should reject if no password is passed', () => {
                const username = 'test';

                return expect(microLDAP.bind(username)).to.eventually.be.rejectedWith(`'password' option must be passed`);
            });

            it('should pass MicroLDAPs options to the LDAP createClient function', () => {
                const username = 'test',
                    password = 'test';

                let createClientStub = sandbox.stub(ldapStub, 'createClient', () => {
                    return mockEmitter;
                });

                microLDAP.bind(username, password);

                return expect(createClientStub).to.have.been.calledWith(microLDAP.options);
            });

            it('should reject if the ldap client emits an error', () => {
                const expectedError = new Error('test'),
                    username = 'test',
                    password = 'test';

                let createClientStub = sandbox.stub(ldapStub, 'createClient', () => {
                    return mockEmitter;
                });

                let bindPromise = microLDAP.bind(username, password);

                mockEmitter.emit('error', expectedError);

                return expect(bindPromise).to.eventually.be.rejectedWith(expectedError);
            });

            describe('after connect', () => {
                const username = 'test',
                    password = 'test';

                let bindPromise;

                beforeEach(() => {
                    sandbox = sinon.sandbox.create();
                    resetEmitter();

                    bindPromise = microLDAP.bind(username, password);
                });

                afterEach(() => {
                    sandbox.restore();
                });

                it('should perform a bind once the ldap client connects', () => {
                    let bindStub = sandbox.stub(mockEmitter, 'bind');

                    mockEmitter.emit('connect');

                    return expect(bindStub).to.have.been.called;
                });

                it('should reject if the ldap bind fails', () => {
                    const expectedError = new Error('test');

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback(expectedError);
                    });

                    mockEmitter.emit('connect');

                    return expect(bindPromise).to.eventually.be.rejectedWith(expectedError);
                });

                it('should destroy the ldap client if the ldap bind fails', () => {
                    let destroyStub = sandbox.stub(mockEmitter, 'destroy');

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback(new Error('test'));
                    });

                    mockEmitter.emit('connect');

                    return bindPromise.catch(() => {
                        return expect(destroyStub).to.have.been.called;
                    });
                });

                it('should resolve if the ldap bind succeeds', () => {
                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback();
                    });

                    mockEmitter.emit('connect');

                    return expect(bindPromise).to.eventually.be.fulfilled;
                });

                it('should destroy the ldap client if the ldap bind succeeds', () => {
                    let destroyStub = sandbox.stub(mockEmitter, 'destroy');

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback();
                    });

                    mockEmitter.emit('connect');

                    return bindPromise.then(() => {
                        return expect(destroyStub).to.have.been.called;
                    });
                });
            });
        });

        describe('search()', () => {
            beforeEach(() => {
                sandbox = sinon.sandbox.create();
                resetEmitter();
            });

            afterEach(() => {
                sandbox.restore();
            });

            it('should return a Promise', () => {
                return expect(microLDAP.search()).to.be.an.instanceOf(Promise);
            });

            it('should reject if no base parameter is passed', () => {
                return expect(microLDAP.search()).to.eventually.be.rejectedWith(`'base' option must be passed`);
            });

            it('should reject if no filter parameter is passed', () => {
                const base = 'test';

                return expect(microLDAP.search(base)).to.eventually.be.rejectedWith(`'filter' option must be passed`);
            });

            it('should reject if no attributes parameter is passed', () => {
                const base = 'test',
                    filter = 'test';

                return expect(microLDAP.search(base, filter)).to.eventually.be.rejectedWith(`'attributes' option must be passed`);
            });

            it('should reject if no scope parameter is passed', () => {
                const base = 'test',
                    filter = 'test',
                    attributes = 'test';

                return expect(microLDAP.search(base, filter, attributes)).to.eventually.be.rejectedWith(`'scope' option must be passed`);
            });

            it('should reject if no username parameter is passed', () => {
                const base = 'test',
                    filter = 'test',
                    attributes = 'test',
                    scope = 'test';

                return expect(microLDAP.search(base, filter, attributes, scope)).to.eventually.be.rejectedWith(`'username' option must be passed`);
            });

            it('should reject if no password parameter is passed', () => {
                const base = 'test',
                    filter = 'test',
                    attributes = 'test',
                    scope = 'test',
                    username = 'test';

                return expect(microLDAP.search(base, filter, attributes, scope, username)).to.eventually.be.rejectedWith(`'password' option must be passed`);
            });

            it('should pass MicroLDAPs options to the LDAP createClient function', () => {
                const base = 'test',
                    filter = 'test',
                    attributes = 'test',
                    scope = 'test',
                    username = 'test',
                    password = 'test';

                let createClientStub = sandbox.stub(ldapStub, 'createClient', () => {
                    return mockEmitter;
                });

                microLDAP.search(base, filter, attributes, scope, username, password);

                return expect(createClientStub).to.have.been.calledWith(microLDAP.options);
            });

            it('should reject if the ldap client emits an error', () => {
                const expectedError = new Error('test'),
                    base = 'test',
                    filter = 'test',
                    attributes = 'test',
                    scope = 'test',
                    username = 'test',
                    password = 'test';

                let createClientStub = sandbox.stub(ldapStub, 'createClient', () => {
                    return mockEmitter;
                });

                let searchPromise = microLDAP.search(base, filter, attributes, scope, username, password);

                mockEmitter.emit('error', expectedError);

                return expect(searchPromise).to.eventually.be.rejectedWith(expectedError);
            });

            describe('after connect', () => {
                const base = 'test',
                    filter = 'test',
                    attributes = 'test',
                    scope = 'test',
                    username = 'test',
                    password = 'test';

                let searchPromise;

                beforeEach(() => {
                    sandbox = sinon.sandbox.create();
                    resetEmitter();

                    searchPromise = microLDAP.search(base, filter, attributes, scope, username, password);
                });

                afterEach(() => {
                    sandbox.restore();
                });

                it('should perform a bind once the ldap client connects', () => {
                    let bindStub = sandbox.stub(mockEmitter, 'bind');

                    mockEmitter.emit('connect');

                    return expect(bindStub).to.have.been.called;
                });

                it('should reject if the ldap bind fails', () => {
                    const expectedError = new Error('test');

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback(expectedError);
                    });

                    mockEmitter.emit('connect');

                    return expect(searchPromise).to.eventually.be.rejectedWith(expectedError);
                });

                it('should destroy the ldap client if the ldap bind fails', () => {
                    let destroyStub = sandbox.stub(mockEmitter, 'destroy');

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback(new Error('test'));
                    });

                    mockEmitter.emit('connect');

                    return searchPromise.catch(() => {
                        return expect(destroyStub).to.have.been.called;
                    });
                });

                it('should call search on the ldap client if the bind succeeds', (done) => {
                    let searchStub = sandbox.stub(mockEmitter, 'search', (base, opts, callback) => {
                        expect(searchStub).to.have.been.called;
                        done();
                    });

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback();
                    });

                    mockEmitter.emit('connect');
                });

                it('should reject if the ldap search fails', () => {
                    let expectedError = new Error('test');

                    let searchStub = sandbox.stub(mockEmitter, 'search', (base, opts, callback) => {
                        callback(expectedError);
                    });

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback();
                    });

                    mockEmitter.emit('connect');

                    return expect(searchPromise).to.eventually.be.rejectedWith(expectedError);
                });

                it('should reject if the ldap search results in non-zero status', () => {
                    let res = new EventEmitter();

                    let result = {
                        status: -1
                    };

                    let searchStub = sandbox.stub(mockEmitter, 'search', (base, opts, callback) => {
                        callback(null, res);
                        res.emit('end', result);
                    });

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback();
                    });

                    mockEmitter.emit('connect');

                    return expect(searchPromise).to.eventually.be.rejectedWith('LDAP search ended with non-0 status');
                });

                it('should resolve with all the results from the search', () => {
                    let res = new EventEmitter();

                    let result = {
                        status: 0
                    };

                    let searchStub = sandbox.stub(mockEmitter, 'search', (base, opts, callback) => {
                        callback(null, res);
                        res.emit('end', result);
                    });

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback();
                    });

                    mockEmitter.emit('connect');

                    return expect(searchPromise).to.eventually.deep.equal([]);
                });

                it('should store all the results from the search', () => {
                    let res = new EventEmitter();

                    let result = {
                        status: 0
                    };

                    let entry1 = 1,
                        entry2 = 2,
                        entry3 = 3;

                    let searchStub = sandbox.stub(mockEmitter, 'search', (base, opts, callback) => {
                        callback(null, res);

                        res.emit('searchEntry', entry1);
                        res.emit('searchEntry', entry2);
                        res.emit('searchEntry', entry3);
                        res.emit('end', result);
                    });

                    let bindStub = sandbox.stub(mockEmitter, 'bind', (username, password, callback) => {
                        callback();
                    });

                    mockEmitter.emit('connect');

                    return expect(searchPromise).to.eventually.deep.equal([entry1, entry2, entry3]);
                });
            });
        });
    });
});
