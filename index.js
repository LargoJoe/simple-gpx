var express = require('express');

var multer = require('multer'); //middleware for form/file upload
var xml2js = require('xml2js');

var archiver = require('archiver'); // zip files



var parseString = xml2js.parseString;
var builder = new xml2js.Builder();

var simplify = require('./simplify.js');
var math = require('./math.min.js');


var storage = multer.memoryStorage();
var upload = multer({storage: storage});


var app = express();



app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));


app.post('/', upload.single('fileinput'), function (req, res) {
    var gpx = req.file.buffer.toString();
    parseString(gpx, function (err, result) {
        if (err) {
            res.send("That doesn't appear to be a GPX file. Use the back arrow and select a valid GPX.");
            return;
        }
        if (!result.hasOwnProperty('gpx')) {
            res.send("That doesn't appear to be a GPX file. Use the back arrow and select a valid GPX.");
            return;
        }
        if (!result.gpx.hasOwnProperty('trk')) {
            res.send("The GPX file doesn't appear to contain a track. Use the back arrow and select another GPX.");
            return;
        }




        result.gpx.$.creator = "Simple GPX https://simple-gpx.herokuapp.com";
        var tracks = result.gpx.trk;

        var tl = tracks.length;

        for (var i = 0; i < tl; ++i) {
            var trksegs = tracks[i].trkseg;
            for (var j = 0; j < trksegs.length; ++j) {
                var trkpts = trksegs[j].trkpt;
                var pts = [];
                for (var k = 0; k < trkpts.length; ++k) {
                    var pt = trkpts[k].$;
                    pt.lat = math.round(pt.lat, 5);
                    pt.lon = math.round(pt.lon, 5);
                    if (req.body.timestamp === "yes") {
                        var timestamp = trkpts[k].time;
                        pt.time = timestamp;
                    }
                    if (req.body.elevation === "yes") {
                        var elevation = trkpts[k].ele;
                        pt.ele = math.round(elevation);
                    }

                    pts.push(pt);
                }


            }

            // Delete all the trksegs
            for (var t = 0; t < trksegs.length; ++t) {
                delete result.gpx.trk[i].trkseg[t];
            }


            /*
             * Simplify and replace trkpoints with simplified trkpoints for
             * this trk
             */

            var tolerance = req.body.tolerance / metre(pts[0].lat);
            var simple_pts = simplify(pts, tolerance);

            var formatted_pts = [];
            for (var l = 0; l < simple_pts.length; ++l) {
                formatted_pts[l] = {};

                formatted_pts[l].$.lat = simple_pts[l].lat;
                formatted_pts[l].$.lon = simple_pts[l].lon;
                if (simple_pts[l].time) {
                    formatted_pts[l].time = simple_pts[l].time;
                }
                if (simple_pts[l].ele) {
                    formatted_pts[l].ele = simple_pts[l].ele;
                }

            }

            result.gpx.trk[i].trkseg[0] = {}
            result.gpx.trk[i].trkseg[0].trkpt = formatted_pts;
            /*
             * Split track
             */
            if (req.body.splittrk === "yes") {


                var split_length = req.body.splitlength * 1000;
                var accumulated_lengths = accumulatedLengths(simple_pts);
                var total_length = accumulated_lengths [accumulated_lengths.length - 1];
                // Don't bother splitting if total length isn't 10% or more longer than
                // split length

                if (total_length > split_length * 1.10) {
                    var extensions = result.gpx.trk[i].extensions;
                    delete result.gpx.trk[i];

                    var split_name = req.body.splitname === "" ? "Track" : req.body.splitname;
                    var last_split = 0;
                    var splits = 1;



                    for (var l = 0; l < accumulated_lengths.length; ++l) {
                        if (accumulated_lengths [l] > split_length * splits) {
                            var trkpts = formatted_pts.slice(last_split, l);
                            last_split = l - 1;

                            var trk_name = split_name + '-' + splits;

                            splits++;
                            var trk = {};

                            trk.name = trk_name;
                            if (typeof extensions === 'object') {
                                trk.extensions = extensions;
                            }
                            trk.trkseg = [];
                            trk.trkseg[0] = {};
                            trk.trkseg[0].trkpt = trkpts;

                            result.gpx.trk.push(trk);
                        }
                    }
                    var trkpts = formatted_pts.slice(last_split, formatted_pts.length);
                    var trk_name = split_name + '-' + splits;
                    var trk = {};
                    trk.name = trk_name;
                    if (typeof extensions === 'object') {
                        trk.extensions = extensions;
                    }
                    trk.trkseg = [];
                    trk.trkseg[0] = {};
                    trk.trkseg[0].trkpt = trkpts;
                    result.gpx.trk.push(trk);

                }


            }




        }



        // Convert back to xml to send back to end user
        var xml = builder.buildObject(result);
        xml = xml.replace(/&#xD;/g, '');
        //zip content to be returned
        var archive = archiver.create('zip', {name: 'phil'});
        var filename = req.file.originalname.substr(0, req.file.originalname.length - 4) + '.zip';
        res.setHeader('Content-disposition', 'attachment; filename=' + filename);
        archive.append(xml, {name: req.file.originalname});
        archive
                .finalize()
                .pipe(res);


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

function accumulatedLengths(coords) {
    if (coords.length === 0)
        return [];
    var total = 0,
            lengths = [0];
    for (var i = 0, n = coords.length - 1; i < n; i++) {
        total += distance(coords[i], coords[i + 1]);
        lengths.push(total);
    }
    return lengths;
}

function distance(coord1, coord2) {
    var lat1 = coord1.lat;
    var lon1 = coord1.lon;
    var lat2 = coord2.lat;
    var lon2 = coord2.lon;

    var radlat1 = Math.PI * lat1 / 180;
    var radlat2 = Math.PI * lat2 / 180;
    var theta = lon1 - lon2;
    var radtheta = Math.PI * theta / 180;
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;
    dist = dist * 1609.344;

    return dist;
}

