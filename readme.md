#gulp-source-scanner

##Overview  
`gulp-source-scanner` is a plugin for the [gulp](http://gulpjs.com/) task runner which tries (without making guarantees, due to the complexity of the task) to detect some critically important file types which are due to be uploaded to source control (e.g. github).

###Why should I use this plugin?
The aim is simple, prevent commonly found, sensitive file types from ending up in your source control repository and thus reduce the risk of leakage. 

###Which types of files can be detected?
Currently, `gulp-source-scanner` will, by default, try to find:  
* SSL/TLS X.509 certificates (admittedly, not critical in most cases)
* SSL/TLS private keys (RSA)
* AWS API access tokens
* AWS API secrets

###How much will this slow down my build?
In some (admittedly random tests) of ~10 genuine codebases pulled from github, the test took less than 2 seconds per codebase, even for 200k+ files.

###How should I use this plugin?
The short answer is "any way you like", the longer answer is:  

My guess/intention is that you'll insert it into your regular `gulp`-based build-chain (likely close to the last step) and probably either output a "clean" set of files to commit to source control or by setting the `failOnDetection` option and failing the build if any suspect files are detected.

##Semver  
This project aims to maintain the [semver](http://semver.org/) version numbering scheme.

##Changelog  
See the [changelog](./changelog.md) file

##Security  
See the [security](./security.md) file

##Requirements  
* Node runtime (I believe v0.12+ will work but haven't tested)
* NPM
* [gulp](http://gulpjs.com/) (obviously!)

##NPM/Node package dependencies  
###Production  
* [through2](https://www.npmjs.com/package/through2) - A gulp plugin simplifying library
* [gulp-util](https://www.npmjs.com/package/gulp-util) - a gulp plugin helper library

###development  
* [mocha](https://www.npmjs.com/package/mocha) - Test runner
* [coveralls](https://www.npmjs.com/package/coveralls) - Code coverage analysis reporter
* [istanbul](https://www.npmjs.com/package/istanbul) - Code coverage
* [mocha-lcov-reporter](https://www.npmjs.com/package/mocha-lcov-reporter) - Code coverage

##Installation  
Installation is super simple, in your command line terminal, just `cd` to your project root and run:  

```
npm install gulp-source-scanner --save-dev
```

##Usage
Runtime usage of `gulp-source-scanner` is very simple, it's used as a regular gulp-plugin in your gulp task(s) and accepts a single `options` argument:

```js
var gulp=require("gulp");
var gss=require("gulp-source-scanner");

var opts=
{
  logLevel:"warn", // "error" || "warn" || "info" || "debug"
  ignoreFilesListLocation:".gitignore", // location of a file which lists files which won't be committed to SC, set to false to disable
  ignoreFilesLargerThanMB:9, // Don't even scan files > this size in MB
  failOnDetection:false, // Fail on detecting a file which matches the defined scanTypes
  removeFilesFromOutput:"matches", // "matches" || "non-matches" || "none"
  scanTypes:
  {
    RSAPublic:[".pem",".crt", ".cert"], // RSA public keys (SSL/TLS cert)
    RSAPrivate:".key", // RSA private keys (SSL/TLS key)
    AWSAccessToken:true, // AWS API token: access token
    AWSSecretToken:true // AWS API token: secret token
  }
};

gulp.task("scan", function()
{
  gulp.src(['./**'])
  .pipe(gss(opts))
  .pipe(gulp.dest('./out-dir'));
});
```

###Controlling the files which will be scanned  
You can use the `gulp.src()` function to determine which files will be scanned. This is standard [gulp behaviour](https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpsrcglobs-options) which can accept anything from single, absolute paths to arrays of many [glob-able](https://github.com/isaacs/node-glob) paths.

###Ignoring files  
`gulp-source-scanner` supports the `.gitignore` file or anything which is compatible with it to provide a list of files to ignore whilst scanning. If your file is not (relative to where you will run your gulp task from) `/.gitignore`, you'll need to use the `ignoreFilesListLocation` option to set its filename and path. Comments (line starting with `#`) in the file will be ignored.

###Options  
`gulp-source-scanner` has a number of options, supplied as an object, by which you can configure the plugin:  

```js
var opts=
{
  logLevel:"warn", // "error" || "warn" || "info" || "debug"
  ignoreFilesListLocation:".gitignore", // location of a file which lists files which won't be committed to SC, set to false to disable
  ignoreFilesLargerThanMB:9, // Don't even scan files > this size in MB
  failOnDetection:false, // Fail on detecting a file which matches the defined scanTypes
  removeFilesFromOutput:"matches", // "matches" || "non-matches" || "none"
  scanTypes:
  {
    RSAPublic:[".pem",".crt", ".cert"], // RSA public keys (SSL/TLS cert)
    RSAPrivate:".key", // RSA private keys (SSL/TLS key)
    AWSAccessToken:true, // AWS API token: access token
    AWSSecretToken:true // AWS API token: secret token
  }
};
```

**NOTE: currently, you must provide all options or none, there is no option-byp-option defaulting**

Most of the above is completely self-explanatory though `scanTypes` warrants a little further explanation. `scanTypes` is an object which contains key-value pairs where the key is a string which must be one of the defined detectable types and the value is one of:   
* `String` - a single filename extension (including the leading `.`) of files to scan
* `Array` of `String`s - one or more file extensions (including the leading `.`) of files to scan
* `true` - scan all files for
* `false` - disable scanning for this type

Thus, for each detectable type, you can determine whether to scan some, all or none of the files defined by `gulp.src()`.

Currently, you cannot filter the files to be scanned for by anything other than their filename extension.


###Controlling the output files  
You can use the standard [`gulp.dest`](https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpdestpath-options) function to determine where the scanned files should be output. `gulp-source-scanner` can filter the output via the option `removeFilesFromOutput` - options for this are:

* `"matches"` - remove files from the output which match a detectable type (i.e. files which contain one or more of the detectable types)
* `"non-matches"` - remove files which do *not* match a detectable type (i.e. files which *do not* contain any of the detectable types)
* `"none"` - do not remove any files from the output

These options (respectively) allow you to output a "clean" set of files, output a "dirty" set of files or output all files.

###Failing a build on detection  
If you want the build (well, strictly speaking, the gulp task) to fail (i.e. throw an error) on detecting a suspect file, use the `failOnDetection` (`Boolean`) option. Sadly, this option is not too pretty as it results in a stacktrace from node though it will (on \*nix systems, not sure about Windows) at least result in a return/exit code of `1` (thus you can detect it programmatically).

##Known issues / to-do  
* Currently, you have to pass in all options - an object merge would be much better
* The AWS secret detection filter sometimes triggers on RSA private keys
* A small number of functions are synchronous - these should be make async for better performance
* Occasionally, an error is thrown - there is no stacktrace and it appears to be a bug in node but I haven't been able to pin it down yet
* Need to add more detectable types (suggestion very welcome via issues!)
* It would be good to support more ignore types (currently it's just github)
* Add and improve tests

##Tests  
There are some very, very basic built-in tests which use [Mocha](https://mochajs.org/), you can run these (after installation) via:

```
npm test
```

All test *should* pass - we use [Travis CI](https://travis-ci.org/neilstuartcraig/gulp-runner-tdp) to verify this with each push to the [GitHub master branch](https://github.com/neilstuartcraig/gulp-runner-tdp).

##Bugs  
If you find a bug, please let me know via an issue.

##Contributing  
If you have ideas for improvements or want to contribute a bug fix, please create an issue first so we can discuss and make sure we don't duplicate efforts and that the idea is in the right direction for the plugin.

##License  
TBC - private, all rights restricted, until otherwise stated
