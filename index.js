var express = require('express');

var multer = require('multer'); //middleware for form/file upload
var xml2js = require('xml2js');

var archiver = require('archiver'); // zip files



var parseString = xml2js.parseString;
var builder = new xml2js.Builder();

var simplify = require('./simplify.js');


var storage = multer.memoryStorage();
var upload = multer({storage: storage});


var app = express();



app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));


app.post('/', upload.single('fileinput'), function (req, res) {
    var gpx = req.file.buffer.toString();
    parseString(gpx, function (err, result) {
        if (err) {
            res.send(err);
            return;
        }
        var tracks = result.gpx.trk;
        var t = tracks.length;
        for (var i = 0; i < tracks.length; ++i) {
            var trksegs = tracks[i].trkseg;
            for (var j = 0; j < trksegs.length; ++j) {
                var trkpts = trksegs[j].trkpt;
                var pts = [];
                for (var k = 0; k < trkpts.length; ++k) {
                    var pt = trkpts[k].$;
                    pts.push(pt);
                }
                /*
                 * Simplify and replace trkpoints with simplified trkpoints for
                 * this trkseg
                 */

                var tolerance = req.body.tolerance / metre(pts[0].lat);
                var simple_pts = simplify(pts, tolerance);
                var formatted_pts = [];
                for (var l = 0; l < simple_pts.length; ++l) {
                    formatted_pts[l] = {};
                    formatted_pts[l].$ = simple_pts[l];
                }
                result.gpx.trk[i].trkseg[j].trkpt = formatted_pts;
            }
        }
        // Convert back to xml to send back to end user
        var xml = builder.buildObject(result);
        //res.set('Content-Disposition', 'attachment; filename=' + 'gpx.zip');
        //zip content to be returned
        var archive = archiver.create('zip', {name: 'phil'});
        var filename = req.file.originalname.substr(0, req.file.originalname.length - 4) + '.zip';
        res.setHeader('Content-disposition', 'attachment; filename=' + filename);
        archive.append(xml, {name: req.file.originalname});
        archive
                .finalize()
                .pipe(res);
        //res.send(xml);

    });
});
app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});
function metre(lat) {
    // metres per degree of latitude
    rlat = lat * Math.PI / 180;
    return 111132.92 - 559.82 * Math.cos(2 * rlat) + 1.175 * Math.cos(4 * rlat);
}
