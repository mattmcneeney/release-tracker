const express = require('express'),
   favicon = require('serve-favicon'),
   githubber = require('./githubber'),
   slacker = require('./slacker'),
   app = express();

/* We require a Github token to start up */
if (process.env.GITHUB_TOKEN == null) {
   console.error('Missing environmental variable GITHUB_TOKEN. Aborting.');
   process.exit(1);
}

app.set('view engine', 'pug');
app.use(favicon('images/favicon.ico'));
app.get('/', function(request, response) {
   response.render("dashboard", githubber.getData());
});
app.get('/health', function(request, response) {
   response.send();
});
app.get('/test-slack', function(request, response) {
   slacker.test(request, response);
});

const port = process.env.PORT || 3000;

app.listen(port, function() {
   console.log('Release checker listening on port %s', port);
});

githubber.start();
slacker.startTracking();
