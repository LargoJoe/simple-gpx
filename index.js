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
    var gpx_filename = req.file.originalname.substr(0, req.file.originalname.length - 4);
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
        if (req.body.proximityalarm !== "None") {
            // Garmin Waypoint extensions
            result.gpx.$["xmlns:wptx1"] = "http://www.garmin.com/xmlschemas/WaypointExtension/v1";
            // Garmin Waypoint proximity alarms
            if (typeof result.gpx.wpt !== "undefined") {

                var proximity = {"wptx1:WaypointExtension": {"wptx1:Proximity": req.body.proximityalarm}};
                for (i = 0; i < result.gpx.wpt.length; i++) {
                    result.gpx.wpt[i].extensions = [];
                    result.gpx.wpt[i].extensions.push(proximity);
                }
            }
        }
        var tracks = result.gpx.trk;
        var tl = tracks.length;
        var input_accuracy = req.body.accuracy;
        for (var i = 0; i < tl; ++i) {

            if (typeof result.gpx.trk[i].extensions !== "undefined") {
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
                        pt.time = trkpts[k].time;
                     
                    }

                    if (pt !== last_pt) {
                        pts.push(pt);
                    }
                    last_pt = pt;
                }


            }


            if (!isNaN(parseInt(input_accuracy))) {


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
                    var total_length = accumulated_lengths[accumulated_lengths.length - 1];
                    // Don't bother splitting if total length isn't 10% or more longer than
                    // split length


                    if (total_length > split_length * 1.10) {
                        delete split_pts[0];
                        split_pts = [];
                        var last_split = 0;
                        var splits = 1;
                        for (var l = 0; l < accumulated_lengths.length; ++l) {
                            if (accumulated_lengths[l] > split_length * splits) {
                                var trkpts = pts.slice(last_split, l);
                                last_split = l - 1;
                                splits++;
                                split_pts.push(trkpts);
                            }
                        }
                        var trkpts = pts.slice(last_split, pts.length);
                        split_pts.push(trkpts);
                    }

                }

                /*
                 * If split by control then split before simplification
                 */
                if (req.body.splittrk === "yes - by waypoint" && result.gpx.wpt !== "undefined") {

                    var tmp = result.gpx.wpt;
                    var wpts = [];
                    var last_pt = {};
                    for (var k = 0; k < tmp.length; ++k) {
                        var wpt = tmp[k].$;
                        wpt.lat = math.round(wpt.lat, 5);
                        wpt.lon = math.round(wpt.lon, 5);
                        if (wpt !== last_pt) {
                            wpts.push(wpt);
                        }
                        last_pt = wpt;
                    }



                    var splits = [];
                    for (var i = 0; i < wpts.length; i++) {
                        var pos = position(wpts[i], pts);
                        if (pos > 10 && pos < pts.length - 10) {
                            splits.push(pos);
                        }

                    }


                    splits.sort(compareNumbers);
                    if (splits.length > 0) {
                        delete split_pts[0];
                        split_pts = [];
                    }

                    var split_name = req.body.splitname === "" ? "Track" : req.body.splitname;
                    var last_split = 0;
                    for (var l = 0; l < splits.length; ++l) {

                        var trkpts = pts.slice(last_split, splits[l]);
                        last_split = splits[l] - 1;
                        split_pts.push(trkpts);
                    }
                    var trkpts = pts.slice(last_split, pts.length);
                    split_pts.push(trkpts);
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

                var total_points = 0;
                for (var s = 0; s < split_pts.length; ++s) {

                    var simple_pts = [];
                    // Need to filter to 500 or 10,000 points
                    if (input_accuracy == 500 || input_accuracy == 10000) {

                        var accuracy_metres = 5;
                        var accuracy = accuracy_metres / metre(split_pts[s][0].lat); // try 10 metres to start
                        var loop = true;
                        if (split_pts[s].length <= input_accuracy) {
                            simple_pts = split_pts[s];
                            loop = false;
                        }


                        while (loop === true) {
                            simple_pts = simplify(split_pts[s], accuracy);
                            if (simple_pts.length > input_accuracy || simple_pts.length < input_accuracy * 0.99) {
                                accuracy = accuracy * simple_pts.length / input_accuracy;
                            } else {
                                loop = false;
                            }
                        }


                    } else {

                        var accuracy = input_accuracy / metre(split_pts[s][0].lat);
                        simple_pts = simplify(split_pts[s], accuracy);
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
                    } else {
                        result.gpx.trk.push(trk_split);
                    }

                    total_points += formatted_pts.length;
                }
            }

        }

        /*
         * if they have chosen to generate route
         */

        if (input_accuracy === "route") {

            /*
             * If there is no route in the file generate a filtered one.
             */
            if (typeof result.gpx.rte === "undefined") {
                result.gpx.rte = [];
                // We want an average of a route point every 5km.
                if (typeof total_length === "undefined") {
                    var accumulated_lengths = accumulatedLengths(pts);
                    var total_length_km = accumulated_lengths[accumulated_lengths.length - 1] / 1000;
                } else {
                    var total_length_km = total_length / 1000;
                }


                input_accuracy_rte = parseInt(total_length_km / 5);
                var accuracy_metres = 50;
                var accuracy = accuracy_metres / metre(pts[0].lat);
                var loop = true;
                if (pts.length <= input_accuracy_rte) {
                    simple_rtes = pts;
                    loop = false;
                }

                while (loop === true) {
                    simple_rtes = simplify(pts, accuracy);
                    if (simple_rtes.length > input_accuracy_rte * 1.2 || simple_rtes.length < input_accuracy_rte * 0.8) {
                        accuracy = accuracy * simple_rtes.length / input_accuracy_rte;
                    } else {
                        loop = false;
                    }




                }

                /*
                 * If there are any waypoints assume they are controls and try and
                 * insert into route
                 */

                if (typeof result.gpx.wpt !== "undefined") {

                    var tmp = result.gpx.wpt;
                    var wpts = [];
                    var last_pt = {};
                    for (var k = 0; k < tmp.length; ++k) {
                        var wpt = tmp[k].$;
                        wpt.lat = math.round(wpt.lat, 5);
                        wpt.lon = math.round(wpt.lon, 5);
                        if (wpt !== last_pt) {
                            wpts.push(wpt);
                        }
                        last_pt = wpt;
                    }


                    for (var i = 0; i < wpts.length; i++) {

                        var pos = position(wpts[i], pts);
                        simple_rtes.splice(position, 0, wpts[i]);
                    }

                }

                // Now add routepoints into GPX, splitting every 50 points.
                if (typeof split_name === "undefined") {
                    split_name = result.gpx.trk[0].name;
                }

                var r = 0;
                var formatted_rtepts = [];
                for (var l = 0; l < simple_rtes.length; ++l) {
                    var rtept = {};

                    rtept.$ = {};
                    rtept.$.lat = simple_rtes[l].lat;
                    rtept.$.lon = simple_rtes[l].lon;
                    formatted_rtepts.push(rtept);
                    if (formatted_rtepts.length === 50) {
                        console.log("split");
                        var rte = {};
                        rte.name = split_name + '-' + r; // route_name
                        r++;
                        rte.rtept = formatted_rtepts;
                        result.gpx.rte.push(rte);
                        var last_rtept = formatted_rtepts[49];
                        formatted_rtepts = [last_rtept];
                    }
                }

                if (formatted_rtepts.length !== 0) {
                    var rte = {};
                    rte.name = split_name + '-' + r; // route_name
                    r++;
                    rte.rtept = formatted_rtepts;
                    result.gpx.rte.push(rte);
                    formatted_rtepts = [];
                }

                var routes_generated = "Routes generated: " + r +
                        ', average points per route: ' + simple_rtes.length / r;
            }

            /*
             * Now delete trk
             */



            delete result.gpx.trk;

        }

        /*
         * Now split out into seperate files for tracks and wpts if
         * split was done.
         */


        var GPX = [];
        var file = 0;

        // Split out a waypoints file if they exist
        if (typeof result.gpx.wpt !== "undefined") {
            GPX[file] = JSON.parse(JSON.stringify(result));
            if (typeof GPX[file].gpx.trk !== "undefined") {
                delete GPX[file].gpx.trk;
            }
            if (typeof GPX[file].gpx.rte !== "undefined") {
                delete GPX[file].gpx.rte;
            }
            file++;
        }
        // Split out track files if they exist
        if (typeof result.gpx.trk !== "undefined") {
            tl_new = result.gpx.trk.length;

            console.log("tracks " + tl_new);

            for (var j = 0; j < tl_new; j++) {

                if (typeof result.gpx.trk[j] !== "undefined") {
                    GPX[file] = JSON.parse(JSON.stringify(result));
                    if (typeof GPX[file].gpx.wpt !== "undefined") {
                        delete GPX[file].gpx.wpt;
                    }
                    if (typeof GPX[file].gpx.rte !== "undefined") {
                        delete GPX[file].gpx.rte;
                    }

                    for (var i = 0; i < tl_new; i++) {
                        if (i !== j) {
                            delete GPX[file].gpx.trk[i];
                        }
                    }
                    file++;
                }
            }
        }
        // Split out rte files if they exist
        if (typeof result.gpx.rte !== "undefined") {
            rl = result.gpx.rte.length;

            for (var j = 0; j < rl; j++) {
                GPX[file] = JSON.parse(JSON.stringify(result));
                if (typeof GPX[file].gpx.wpt !== "undefined") {
                    delete GPX[file].gpx.wpt;
                }
                if (typeof GPX[file].gpx.trk !== "undefined") {
                    delete GPX[file].gpx.trk;
                }

                for (var i = 0; i < rl; i++) {
                    if (i != j) {
                        delete GPX[file].gpx.rte[i];
                    }
                }
                file++;
            }
        }

        // Convert back to xml to send back to end user
        var archive = archiver.create('zip', {name: 'phil'});
        var filename = gpx_filename + '.zip';
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        // Now add all the GPX files to the archive;
        var a_gpx_filename = '';
        var files_num = GPX.length;
        var xml = '';
        var trk = 0;
        var rte = 0;
        for (k = 0; k < files_num; k++) {
            if (typeof GPX[k].gpx.wpt !== "undefined") {
                a_gpx_filename = gpx_filename + '_wpts' + ".gpx";
                xml = builder.buildObject(GPX[k]);
                xml = xml.replace(/&#xD;/g, '');
                archive.append(xml, {name: a_gpx_filename});
            }
            if (typeof GPX[k].gpx.trk !== "undefined") {
                a_gpx_filename = gpx_filename + '_trk' + trk + ".gpx";
                xml = builder.buildObject(GPX[k]);
                xml = xml.replace(/&#xD;/g, '');
                archive.append(xml, {name: a_gpx_filename});
                trk++;
            }
            if (typeof GPX[k].gpx.rte !== "undefined") {


                if (typeof GPX[k].gpx.rte[0] !== "undefined") {
                    var rtepts = GPX[k].gpx.rte[0].rtept;

                    var rtepts_length = rtepts.length;
                    GPX[k].gpx.wpt = [];
                    for (var m = 0; m < rtepts_length; m++) {
                        var name = "R" + rte + "_" + m;

                        var lat = rtepts[m].$.lat;
                        var lon = rtepts[m].$.lon;
                        var wpt = {};
                        wpt.$ = {};
                        wpt.$.lat = lat;
                        wpt.$.lon = lon;
                        rtepts[m].name = name;
                        wpt.name = name;

                        GPX[k].gpx.wpt.push(wpt);
                    }
                }

                a_gpx_filename = gpx_filename + '_rte' + rte + ".gpx";
                xml = builder.buildObject(GPX[k]);
                xml = xml.replace(/&#xD;/g, '');
                archive.append(xml, {name: a_gpx_filename});
                rte++;
            }

        }



        // Now add the stats file
        txt = "Simple GPX" + "\r\n" +
                "https://simple-gpx.herokuapp.com" + "\r\n" +
                "Tolerance chosen: " + input_accuracy + "\r\n";
        if (!isNaN(parseInt(input_accuracy))) {
            txt += "Split track: " + req.body.splittrk +
                    ", split distance: " + req.body.splitlength + "km \r\n" +
                    "Original tracks: " + tl +
                    ", simplified tracks: " + split_pts.length + "\r\n" +
                    "Original trackpoints: " + pts.length +
                    ", simplified trackpoints: " + total_points +
                    ", average trackpoints per track: " + parseInt(total_points / split_pts.length) + "\r\n";
        }
        if (typeof routes_generated !== "undefined") {
            txt += routes_generated;
        }


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

function position(wpt, simple_pts) {
    var last_distance = 999999;
    var prev_distance = 999999;
    var nextNearest = -10;
    for (var j = 0; j < simple_pts.length; j++) {
        var dist = distance(wpt, simple_pts[j]);
        if (dist <= last_distance) {
            prev_distance = last_distance;
            last_distance = dist;
            if (typeof nearest !== "undefined") {
                var nextNearest = nearest;
            }
            var nearest = j;
            if (nextNearest === -10) {
                var nextNearest = nearest;
            }

        } else {
            if (dist <= prev_distance) {
                nextNearest = j;
            }

        }

    }
    /*
     * Now return position in pts array
     */

    var position = Math.min(nearest, nextNearest) + 1;
    return position;
}

function compareNumbers(a, b) {
    return a - b;
}

