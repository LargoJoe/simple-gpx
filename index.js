var express = require('express');
var multer = require('multer'); //middleware for form/file upload
var xml2js = require('xml2js');
var simplify = require('./simplify');

var simple = simplify();



var storage = multer.memoryStorage();
var upload = multer({storage: storage});


var app = express();



app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));


app.post('/', upload.single('fileinput'), function (req, res) {
    var gpx = req.file.buffer.toString();
    var parseString = xml2js.parseString;
    parseString(gpx, function (err, result) {
        res.send(result);
    });

});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});



