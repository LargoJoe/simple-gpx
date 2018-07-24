var express = require('express');
var multer = require('multer'); //middleware for form/file upload
var xml2js = require('xml2js');
var archiver = require('archiver'); // zip files

var crypto = require('crypto');
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

            if (typeof result.gpx.trk[i].extensions != "undefined")
            {
                delete result.gpx.trk[i].extensions;
            }
            var trksegs = tracks[i].trkseg;
            for (var j = 0; j < trksegs.length; ++j) {
                var trkpts = trksegs[j].trkpt;
                var pts = [];
                var last_pt = {};
                for (var k = 0; k < trkpts.length; ++k) {
                    var pt = trkpts[k].$;
                    pt.lat = math.round(pt.lat, 5);
                    pt.lon = math.round(pt.lon, 5);
                    if (req.body.elevation === "yes") {
                        var elevation = trkpts[k].ele;
                        pt.ele = math.round(elevation);
                        pt.ele_z = math.round(elevation) / metre(pt.lat);
                    }

                    if (req.body.timestamp === "yes") {
                        var timestamp = trkpts[k].time;
                        pt.time = timestamp;
                    }

                    if (pt !== last_pt) {
                        pts.push(pt);
                    }
                    last_pt = pt;
                }


            }





            // Delete all the trksegs
            for (var t = 0; t < trksegs.length; ++t) {
                delete result.gpx.trk[i].trkseg[t];
            }

            if (typeof result.gpx.trk[i].trkseg != "undefined") {
                delete result.gpx.trk[i].trkseg;
            }

            /*
             * If required split track points up ready for simplification
             */
            var split_pts = [pts];
            if (req.body.splittrk === "yes") {

                var split_name = req.body.splitname === "" ? "Track" : req.body.splitname;

                var split_length = req.body.splitlength * 1000;
                var accumulated_lengths = accumulatedLengths(pts);


                var total_length = accumulated_lengths [accumulated_lengths.length - 1];
                // Don't bother splitting if total length isn't 10% or more longer than
                // split length


                if (total_length > split_length * 1.10) {
                    delete split_pts[0];
                    split_pts = [];
                    var split_name = req.body.splitname === "" ? "Track" : req.body.splitname;
                    var last_split = 0;
                    var splits = 1;
                    for (var l = 0; l < accumulated_lengths.length; ++l) {
                        if (accumulated_lengths [l] > split_length * splits) {
                            var trkpts = pts.slice(last_split, l);
                            last_split = l - 1;
                            splits++;
                            split_pts.push(trkpts);

                        }
                    }
                    var trkpts = pts.slice(last_split, pts.length);
                    split_pts.push(trkpts)

                }

            }


            /*
             * If track has been split then delete original track from
             * returned GPX
             */

            if (split_pts.length > 1) {
                delete result.gpx.trk[i];
            }



            /*
             * Simplify and replace trkpoints with simplified trkpoints for
             * this trk
             */



            for (var s = 0; s < split_pts.length; ++s) {

                var input_tolerance = req.body.tolerance;

                var simple_pts = [];
                // Need to filter to 500 or 10,000 points
                if (input_tolerance == 500 || input_tolerance == 10000) {

                    var tolerance_metres = 5;
                    var tolerance = tolerance_metres / metre(split_pts[s][0].lat); // try 10 metres to start
                    var loop = true;

                    if (split_pts[s].length <= input_tolerance) {
                        simple_pts = split_pts[s];
                        loop = false;
                    }


                    while (loop === true) {
                        simple_pts = simplify(split_pts[s], tolerance);

                        if (simple_pts.length > input_tolerance || simple_pts.length < input_tolerance * 0.99)
                        {
                            tolerance = tolerance * simple_pts.length / input_tolerance;
                        } else
                        {
                            loop = false;
                        }
                    }


                } else
                {

                    var tolerance = input_tolerance / metre(split_pts[s][0].lat);
                    simple_pts = simplify(split_pts[s], tolerance);
                }
                var formatted_pts = [];
                for (var l = 0; l < simple_pts.length; ++l) {
                    formatted_pts[l] = {};
                    formatted_pts[l].$ = {};
                    formatted_pts[l].$.lat = simple_pts[l].lat;
                    formatted_pts[l].$.lon = simple_pts[l].lon;
                    if (simple_pts[l].ele) {
                        formatted_pts[l].ele = simple_pts[l].ele;
                    }

                    if (simple_pts[l].time) {
                        formatted_pts[l].time = simple_pts[l].time;
                    }


                }

                var trk_split = {};
                trk_split.name = split_name + '-' + s; // track nam
                trk_split.trkseg = [];
                trk_split.trkseg[0] = {};
                trk_split.trkseg[0].trkpt = formatted_pts;


                if (split_pts.length === 1) {
                    trk_split.name = result.gpx.trk[i].name;
                    result.gpx.trk[i] = trk_split;
                } else
                {
                    result.gpx.trk.push(trk_split);
                }


            }
        }

        // Convert back to xml to send back to end user
        var xml = builder.buildObject(result);
        xml = xml.replace(/&#xD;/g, '');
        //zip content to be returned
        var archive = archiver.create('zip', {name: 'phil'});
        var filename = req.file.originalname.substr(0, req.file.originalname.length - 4) + '.zip';
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        archive.append(xml, {name: req.file.originalname});
        // Now add the stats file
        txt = "Simple GPX" + "\r\n" +
                "https://simple-gpx.herokuapp.com" + "\r\n" +
                "Tolerance chosen: " + input_tolerance + "\r\n" +
                "Original trackpoints: " + pts.length +
                ", simplified trackpoints: " + simple_pts.length;

        archive.append(txt, {name: 'stats.txt'});


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
    var log = true;

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

    if (lat1 === lat2 && lon1 === lon2) {
        return 0;
    }


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

