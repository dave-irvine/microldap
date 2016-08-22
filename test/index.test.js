/*eslint-env mocha */
/*eslint-disable no-unused-expressions*/
'use strict';

import chai, {expect} from 'chai';

import micro_ldap from '../src';
import MicroLDAP from '../src/MicroLDAP';

describe('microldap', () => {
    it('should export a function', () => {
        return expect(micro_ldap).to.be.a('function');
    });

    it('should export a function that returns an instance of MicroLDAP', () => {
        let microLDAP = micro_ldap({ url: 'ldap://' });

        return expect(microLDAP).to.be.an.instanceOf(MicroLDAP);
    });
});
