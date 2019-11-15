const path = require('path');
const fs = require('fs');
const express = require('express');
const redis = require('redis');
const os = require('os');
const https = require('https');
const client = redis.createClient();
const app = express();
const Symple = require('./server/symple.js');

const ifaces = os.networkInterfaces();
let localIp = '127.0.0.1';


Object.keys(ifaces).forEach(function (ifname) {
  var alias = 0;

  ifaces[ifname].forEach(function (iface) {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }

    if (alias >= 1) {
      // this single interface has multiple ipv4 addresses
      console.log(ifname + ':' + alias, iface.address);   
    } else {
      // this interface has only one ipv4 adress
      console.log(ifname, iface.address);
    }
    ++alias;
    localIp = iface.address;
  });
});






const config = {
  /* The port to listen on */
  "port" : 4551,

  /* Allow anonymous connections */
  "anonymous" : false,

  /* Session ttl in minutes */
  "sessionTtl" : 15,

  /* Redis configuration */
  "redis" : {
    "host" : "localhost",
    "port" : 6379
  },

  /* SSL configuration */

  ssl: {
    enabled: true,
    "key" : path.resolve(__dirname, "./ssl/MyKey.key"), 
    "cert" : path.resolve(__dirname, "./ssl/MyCertificate.crt")
  }   
}




const sy = new Symple();
sy.loadJson(config);
sy.init();
console.log('Symple server listening on port ' + sy.config.port);


const serverPort = parseInt(sy.config.port);
const clientPort = serverPort - 1;

app.set('port', clientPort);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/');
app.use(express.static(__dirname + '/assets'));
app.use(express.static(__dirname + '/client'));
app.use(express.static(__dirname + '/client-player'));

app.get('/', function (req, res) {
  // Create a random token to identify this client
  // NOTE: This method of generating unique tokens is not secure, so don't use
  // it in production ;)
  var token = String(Math.random());

  // Create the arbitrary user session object here
  var session = {
    // user: 'demo',
    // name: 'Demo User',
    group: 'public'
  }

  // Store the user session on Redis
  // This will be sent to the Symple server to authenticate the session
  client.set('symple:session:' + token, JSON.stringify(session), redis.print);

  // Render the response
  res.render(
    'index', 
    {
      url: `https://${localIp}:${serverPort}`,
      token: token,
      peer: session,
    }
  );
});

var options = {
  key: fs.readFileSync(config.ssl.key),
  cert: fs.readFileSync(config.ssl.cert)
};


https.createServer(options, app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
  console.log(`https://${localIp}:${app.get('port')}`);
});


