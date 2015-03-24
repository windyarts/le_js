var gulp = require('gulp');
var concat = require('gulp-concat');
var karma = require('gulp-karma');
var closureCompiler = require('gulp-closure-compiler');
var rename = require('gulp-rename');
var replace = require('gulp-replace');

var testFiles = [
    'src/le.js',
    'test/md5.js',
    'test/sinon*.js',
    'test/*Spec.js'
];
var apiVersion = 1;
var apiEndpoint = 'api.traintracks.io/v' + apiVersion + '/events';


gulp.task('default', ['test', 'build']);


gulp.task('watch', function() {
    gulp.watch('src/le.js', ['test']);
});


gulp.task('build', function() {
    return gulp.src('src/le.js')
        .pipe(concat('le.js')) // We've only got one file but still need this
        .pipe(replace(/localhost:8080\/v1/g, apiEndpoint))
        .pipe(gulp.dest('product'))
        .pipe(closureCompiler({
            compilation_level: 'SIMPLE_OPTIMIZATIONS',
            warning_level: 'VERBOSE',
            debug: false,
            language_in: 'ECMASCRIPT5_STRICT',
            externs: 'deps/umd-extern.js'
        }))
        .pipe(rename('le.min.js'))
        .pipe(gulp.dest('product'));
});


gulp.task('test', function() {
    return gulp.src(testFiles)
        .pipe(karma({
            configFile: 'karma.conf.js',
            action: 'start',
            singleRun: true,
            browsers: ['PhantomJS']
        }));
});
