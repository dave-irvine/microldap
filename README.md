[![Build Status](https://travis-ci.org/dave-irvine/microldap.svg?branch=master)](https://travis-ci.org/dave-irvine/microldap)
MicroLDAP
---------

This library provides two simple calls for binding to an LDAP server, and performing a search as a user on an LDAP server.

##Installation

```npm install microldap```

##Usage

```
  var microldap = require('microldap')({ url: 'ldap://my.ldap.server' });

  microldap.bind(username, password).then(function () {
    //bind succeeded
  }, function (err) {
    //bind failed
  });

  microldap.search(base, filter, attributes, scope, username, password).then(function (results) {
    //search succeeded
  }, function (err) {
    //search failed
  });
```

##API

###bind(username, password)
Takes a username and password and attempts to bind to an LDAP server. Returns a Promise.
The Promise resolves if the bind succeeds.

###search(base, filter, attributes, scope, username, password)
Takes a base, filter, attribute list, scope, username and password and searches an LDAP directory as that user. Returns a Promise.
The Promise resolves with an array of search results if the search succeeds.

##Other functions
This library provides only bind and search.
