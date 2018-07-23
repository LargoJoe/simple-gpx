/*
 (c) 2013, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
 */

(function () {


// to suit your point format, run search/replace for '.lat' and '.lon';
// for 3D version, see 3d branch (configurability would draw significant performance overhead)

// square distance between 2 points
    function getSqDist(p1, p2) {

        var dx = p1.lat - p2.lat,
                dy = p1.lon - p2.lon;

        if (p1.ele_z === undefined) {
            dz = 0;
        } else {
            dz = p1.ele_z - p2.ele_z;
        }


        return dx * dx + dy * dy + dz * dz;
    }
// Square of the distance of a point from a line
    function getSqSegDist(p, p1, p2) {
        // Get the lengths of the three sides of the triangle
        var A = Math.sqrt(getSqDist(p1, p2));
        var B = Math.sqrt(getSqDist(p, p1));
        var C = Math.sqrt(getSqDist(p, p2));
        if (A === 0) {
            return 10;
        }

        if (B === 0 || C === 0) {
            return 0;
        }
        // Calculate area of triangle using Heron's formula.
        var S = (A + B + C) / 2;
        var Area = Math.sqrt(S * (S - A) * (S - B) * (S - C));

        // Square of the distance
        return Math.pow(2 * Area / A, 2);

    }


// square distance from a point to a segment
    function getSqSegDistOrig(p, p1, p2) {

        var x1 = p1.lon,
                y1 = p1.lat,
                z1 = (p1.ele_z === undefined) ? 0 : p1.ele_z,
                x2 = p2.lon,
                y2 = p2.lat,
                z2 = (p2.ele_z === undefined) ? 0 : p2.ele_z,
                dx = x2 - x1,
                dy = y2 - y1,
                dz = z2 - z1,
                x0 = p.lon,
                y0 = p.lat,
                z0 = (p.ele_z === undefined) ? 0 : p.ele_z;

        var D2 = dy * x0 - dx * y0 + x2 * y1 - y2 * x1;
        var D3 = dy * x0 - dx * y0 + x2 * y1 - y2 * x1 +
                dz * x0 - dx * z0 + x2 * z1 - z2 * x1 +
                dz * y0 - dy * z0 + y2 * z1 - z2 * y1;


        var numerator = Math.pow(D3, 2);

        var denominator = Math.pow(dy, 2) + Math.pow(dx, 2) + Math.pow(dz, 2);

        if (p.lat === p1.lat && p.lon === p1.lon) {
            return 0;
        }
        if (p.lat === p2.lat && p.lon === p2.lon) {
            return 0;
        }

        if (numerator === 0 | denominator === 0) {
            return 10;
        }




        return numerator / denominator;
    }
// rest of the code doesn't care about point format

// basic distance-based simplification
    function simplifyRadialDist(points, sqTolerance) {

        var prevPoint = points[0],
                newPoints = [prevPoint],
                point;

        for (var i = 1, len = points.length; i < len; i++) {
            point = points[i];

            if (getSqDist(point, prevPoint) > sqTolerance) {
                newPoints.push(point);
                prevPoint = point;
            }
        }

        if (prevPoint !== point)
            newPoints.push(point);

        return newPoints;
    }

    function simplifyDPStep(points, first, last, sqTolerance, simplified) {
        var maxSqDist = sqTolerance,
                index;

        for (var i = first + 1; i < last; i++) {
            var sqDist = getSqSegDistOrig(points[i], points[first], points[last]);

            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }

        if (maxSqDist > sqTolerance) {

            if (index - first > 1)
                simplifyDPStep(points, first, index, sqTolerance, simplified);
            simplified.push(points[index]);
            if (last - index > 1)
                simplifyDPStep(points, index, last, sqTolerance, simplified);
        }
    }

// simplification using Ramer-Douglas-Peucker algorithm
    function simplifyDouglasPeucker(points, sqTolerance) {
        var last = points.length - 1;

        var simplified = [points[0]];
        simplifyDPStep(points, 0, last, sqTolerance, simplified);
        simplified.push(points[last]);

        return simplified;
    }

// both algorithms combined for awesome performance
    function simplify(points, tolerance, highestQuality) {

        if (points.length <= 2)
            return points;

        var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

        points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);

        points = simplifyDouglasPeucker(points, sqTolerance);

        return points;
    }

// export as AMD module / Node module / browser or worker variable
    if (typeof define === 'function' && define.amd)
        define(function () {
            return simplify;
        });
    else if (typeof module !== 'undefined')
        module.exports = simplify;
    else if (typeof self !== 'undefined')
        self.simplify = simplify;
    else
        window.simplify = simplify;

})();


