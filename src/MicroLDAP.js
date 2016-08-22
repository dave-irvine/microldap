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

    bind(username, password) {
        debug(`bind(${username},***`);

        return new Promise((resolve, reject) => {
            if (!username) {
                return reject(new Error(`'username' option must be passed`));
            }

            if (!password) {
                return reject(new Error(`'password' option must be passed`));
            }

            let client = ldap.createClient(this.options);

            client.on('connect', () => {
                debug('connected');

                _bind(client, username, password).then(() => {
                    debug(`bind success`);
                    debug(`destroying client`);
                    client.destroy();
                    return resolve();
                }).catch((err) => {
                    debug(`bind failure`);
                    debug(`destroying client`);
                    client.destroy();
                    return reject(err);
                });
            });

            client.on('error', (err) => {
                return reject(err);
            });
        });
    }
}

function _bind(client, username, password) {
    debug(`_debug(${client}, ${username}, ***`);

    return new Promise((resolve, reject) => {
        client.bind(username, password, (err) => {
            debug(`client.bind returned`);
            if (err) {
                return reject(err);
            }

            return resolve();
        });
    });
}
