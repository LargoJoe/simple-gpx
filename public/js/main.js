/*
 * Phil Whitehurst
 */

$(document).ready(function () {
    $('#fileinput').on('change',
            function (e) {
                var file = $('#fileinput').val()
                if (file.length > 0) {
                    $('#gpx-simplify-form').submit();
                }
            });
    $('#tolerance').on('change',
            function (e) {
                var file = $('#fileinput').val()
                if (file.length > 0) {

                    $('#gpx-simplify-form').submit();
                }
            });
});

