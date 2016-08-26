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

    search(base, filter, attributes, scope, username, password) {
        debug(`search(${base}, ${filter}, ${attributes}, ${scope}, ${username}, ***)`);

        return new Promise((resolve, reject) => {
            if (!base) {
                return reject(new Error(`'base' option must be passed`));
            }

            if (!filter) {
                return reject(new Error(`'filter' option must be passed`));
            }

            if (!attributes) {
                return reject(new Error(`'attributes' option must be passed`));
            }

            if (!scope) {
                return reject(new Error(`'scope' option must be passed`));
            }

            if (!username) {
                return reject(new Error(`'username' option must be passed`));
            }

            if (!password) {
                return reject(new Error(`'password' option must be passed`));
            }

            let client = ldap.createClient(this.options);

            let doSearch = function () {
                debug(`bind success`);
                let opts = {
                    filter,
                    scope,
                    attributes
                };

                client.search(base, opts, (err, res) => {
                    debug(`client.search returned`);
                    let entries = [];

                    if (err) {
                        debug(`search failure`);
                        return reject(err);
                    }

                    res.on('searchEntry', (entry) => {
                        debug(`received search entry`);
                        entries.push(entry);
                    });

                    res.on('end', (result) => {
                        debug(`search end`);
                        debug(`destroying client`);

                        client.destroy();

                        if (result.status === 0) {
                            return resolve(entries);
                        }

                        return reject(new Error(`LDAP search ended with non-0 status: ${result}`));
                    });
                });
            };

            client.on('connect', () => {
                debug('connected');

                _bind(client, username, password).then(doSearch).catch((err) => {
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
