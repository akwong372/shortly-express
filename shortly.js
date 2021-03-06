var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(session({
  secret: 'arandomstring',
  resave: false,
  saveUninitialized: false,
  cookie: { expires: 600000 }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

var checkUser = function (session) {
  if (session.user) {
    return true;
  } else {
    return false;
  }
};

app.get('/',
  function (req, res) {
    if (checkUser(req.session)) {
      res.render('index');
    } else {
      res.redirect('/login');
    }
  });

app.get('/create',
  function (req, res) {
    if (checkUser(req.session)) {
      res.render('index');
    } else {
      res.redirect('/login');
    }
  });

app.get('/links',
  function (req, res) {
    if (checkUser(req.session)) {
      Links.reset().fetch().then(function (links) {
        res.status(200).send(links.models);
      });
    } else {
      res.redirect('/login');
    }
    
  });

app.post('/links',
  function (req, res) {
    var uri = req.body.url;

    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.sendStatus(404);
    }

    new Link({ url: uri }).fetch().then(function (found) {
      // console.log('found', found);
      if (found) {
        // console.log('found', found.attributes.code);
        res.status(200).send(found.attributes);
      } else {
        util.getUrlTitle(uri, function (err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.sendStatus(404);
          }

          Links.create({
            url: uri,
            title: title,
            baseUrl: req.headers.origin
          })
            .then(function (newLink) {
              // console.log('newLink', newLink);
              res.status(200).send(newLink);
            });
        });
      }
    });
  });

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.post('/',
  function (req, res) {
    if (checkUser(req.session)) {
      req.session.destroy(function(err) {
        if (err) {
          console.log('err', err);
        }
      });
      res.render('login');
    } else {
      res.render('login');
    }
  });

app.get('/login',
  function (req, res) {
    if (checkUser(req.session)) {
      res.redirect('/');
    } else {
      res.render('login');
    }
  });

app.post('/login', function (req, res) {
  // console.log(req.body);
  var username = req.body.username;
  var enteredPass = req.body.password;

  User.where({ username: username }).fetch()
    .then(function (found) {
      if (found) {
        console.log('found user');

        bcrypt.compare(enteredPass, found.get('password'), function (err, results) {
          // console.log('enteredPass', enteredPass);
          // console.log('databasePass', found.get('password'));
          if (results) {
            req.session.regenerate(function () {
              req.session.user = username;
              res.redirect('/');
            });
          } else {
            console.log('password does not match');
            res.redirect('/login');
          }
        });

      } else {
        console.log('username did not match, redirecting to signup');
        res.redirect('/login');
      }
    });
});

app.get('/signup',
  function (req, res) {
    if (checkUser(req.session)) {
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });

app.post('/signup', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  User.where({ username: username }).fetch()
    .then(function (found) {
      if (!found) {
        var user = new User({ username: username, password: password });
        user.save()
          .then(function () {
            req.session.regenerate(function () {
              req.session.user = user;
              res.redirect('/');
            });
          });
      } else {
        res.redirect('/login');
      }
    });

});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function (req, res) {
  new Link({ code: req.params[0] }).fetch().then(function (link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function () {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function () {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
