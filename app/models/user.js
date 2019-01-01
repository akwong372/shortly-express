var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Link = require('./link.js');

var User = db.Model.extend({
  tableName: 'users',
  // hasTimestamps: true,
  link: function() {
    return this.hasMany(Link);
  },
  initialize: function() {
    this.on('creating', this.hashPassword);
  },
  hashPassword: function(model, attr, options) {
    return new Promise(function(resolve, reject) {
      bcrypt.hash(model.attributes.password, null, null, function(err, hash) {
        if (err) {
          reject(err);
        }
        model.set('password', hash);
        resolve(hash);
      });
    });
  }
});

module.exports = User;