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
    $('#splittrk').on('change',
            function (e) {
                var file = $('#fileinput').val()
                if (file.length > 0) {

                    $('#gpx-simplify-form').submit();
                }
            });
    $('#splitname').on('change',
            function (e) {
                var file = $('#fileinput').val()
                if (file.length > 0) {

                    $('#gpx-simplify-form').submit();
                }
            });
    $('#splitlength').on('change',
            function (e) {
                var file = $('#fileinput').val()
                if (file.length > 0) {

                    $('#gpx-simplify-form').submit();
                }
            });
});

