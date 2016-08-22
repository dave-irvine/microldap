/*eslint-env mocha */
/*eslint-disable no-unused-expressions*/
'use strict';

import chai, {expect} from 'chai';
import mock from 'mock-fs';

import MicroLDAP from '../src/MicroLDAP';

describe('MicroLDAP', () => {
    describe('constructor()', () => {
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
});
