var express = require('express');
var bodyParser = require("body-parser");
var xml2js = require('node-xml2js');


var app = express();



app.set('port', (process.env.PORT || 5000));


app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

app.post('/', function (req, res) {
    var parseString = xml2js.parseString;
    fs.readFile(req.files.file - input.path, function (err, data) {

        res.send(data);
    });



});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});



