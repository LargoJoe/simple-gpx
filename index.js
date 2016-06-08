var express = require('express');
var bodyParser = require("body-parser");
var xml2js = require('xml2js');
var fs = require('fs');


var app = express();



app.set('port', (process.env.PORT || 5000));


app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

app.post('/', function (req, res) {
    var parseString = xml2js.parseString;
    var data = JSON.stringify(req);
    res.send(data);
    /*fs.readFile(req.files.fileinput.path, function (err, data) {
     if (err) {
     res.send(err);
     }
     res.send(data);
     });
     */
});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});



