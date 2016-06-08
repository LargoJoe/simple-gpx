var express = require('express');
var multer = require('multer'); //middleware for form/file upload
var xml2js = require('xml2js');
var simplify = require('./simplify.js');


var storage = multer.memoryStorage();
var upload = multer({storage: storage});


var app = express();



app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));


app.post('/', upload.single('fileinput'), function (req, res) {
    var gpx = req.file.buffer.toString();
    var parseString = xml2js.parseString;
    parseString(gpx, function (err, result) {
        var tracks = result.gpx.trk;
        for (var i = 0; i < tracks.length; ++i) {
            var trksegs = tracks[i].trkseg;
            for (var j = 0; j < trksegs.length; ++j) {
                var trkpts = trksegs[j].trkpt;
                var pts = []
                var simple_pts;
                for (var k = 0; k < trkpts.length; ++k) {
                    var pt = trkpts[k].$;
                    pts.push(pt);
                    var simple_pts = simplify(pts, 0.01);
                }
                res.send(simple_pts);

            }
        }


        //var trk = result.gpx.trk[0].trkseg[0].trkpt[1].$;

        //res.send(trk);
    });

});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});



