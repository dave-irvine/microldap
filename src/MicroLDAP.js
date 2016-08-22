import assert from 'assert';
import dbg from 'debug';
import fs from 'fs';
import ldap from 'ldapjs';
import splitca from 'split-ca';

const debug = dbg('MicroLDAP');

export default class MicroLDAP {
    constructor(opts) {
        debug(`constructor`);

        assert(opts, `options object must be passed`);
        assert(opts.url, `'url' must be included in options`);
        assert(opts.url.match(/(?:ldap)s?(?::\/\/)/), `'url' must be of ldap(s):// form`)

        this.options = {
            url: opts.url,
            tlsOptions: {
                rejectUnauthorized: true
            }
        };

        if (opts.rejectUnauthorized !== undefined && !opts.rejectUnauthorized) {
            this.options.tlsOptions.rejectUnauthorized = false;
        }

        if (opts.ca) {
            let caExists = false;

            try {
                const caFileStat = fs.statSync(opts.ca);
                caExists = caFileStat && caFileStat.isFile();
            } catch(err) {
                throw new Error(`'ca' path must exist`);
            }

            assert(caExists, `'ca' path must exist`);
            this.options.tlsOptions.ca = splitca(opts.ca);
        }

        debug(this.options);
    }
}
