/*
 * Phil Whitehurst
 */

$(document).ready(function () {
    $('#fileinput').on('change',
            function (e) {

                $('#gpx-simplify-form').submit();
            });
    $('#tolerance').on('change',
            function (e) {
                if $('#fileinput').val().length > 0) {
                    $('#gpx-simplify-form').submit();
                }
            });
});

