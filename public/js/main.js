/*
 * Phil Whitehurst
 */

$(document).ready(function () {
    $('#file-input').on('change',
            function (e) {
                $('gpx-simplify-form').submit();
            });
});

