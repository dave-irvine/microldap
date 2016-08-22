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

    describe('bind()', () => {
        let ldapStub,
            MicroLDAP,
            microLDAP,
            microLDAPOpts,
            mockEmitter,
            sandbox;

        beforeEach(() => {
            sandbox = sinon.sandbox.create();
            mockEmitter = new EventEmitter;

            ldapStub = {
                createClient: () => { return mockEmitter; }
            };

            mockEmitter.bind = function () {};
            mockEmitter.destroy = function () {};

            MicroLDAP = proxyquire('../src/MicroLDAP', {
                'ldapjs': ldapStub,
            }).default;

            microLDAPOpts = {
                url: "ldaps://"
            };

            microLDAP = new MicroLDAP(microLDAPOpts);
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
                bindPromise = microLDAP.bind(username, password);
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
});
