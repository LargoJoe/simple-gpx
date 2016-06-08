var express = require('express');
var multer = require('multer'); //middleware for form/file upload
var xml2js = require('xml2js');
var fs = require('fs');


var app = express();



app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));


app.post('/', function (req, res) {
    res.send(req.file);
});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});



