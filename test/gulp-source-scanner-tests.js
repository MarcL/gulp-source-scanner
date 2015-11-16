/*

THIS NEEDS A LOT OF WORK!

*/

var gulp=require("gulp");
var gss=require("../gulp-source-scanner.js");

// for tests
var assert=require("assert");
var should=require("should");
var path=require("path");

describe("gulp-source-scanner", function()
{
  it("should create a new gulp task called 'gss'", function(done)
  {
    var opts=
    {
      logLevel:"debug", // "error" || "warn" || "info" || "debug"
      ignoreFilesListLocation:".gitignore", // location of a file which lists files which won't be committed to SC, set to false to disable
      ignoreFilesLargerThanMB:8, // Don't even scan files > this size in MB
      failOnDetection:false, // Fail on detecting a file which matches the defined scanTypes
      removeFilesFromOutput:"non-matches", // "matches" || "non-matches" || "none"
      scanTypes:
      {
        RSAPublic:[".pem",".crt", ".cert"], // RSA public keys (SSL/TLS cert)
        // RSAPublic:true, // RSA public keys (SSL/TLS cert)
        RSAPrivate:".key", // RSA private keys (SSL/TLS key)
        // RSAPrivate:true, // RSA private keys (SSL/TLS key)
        AWSAccessToken:true, // AWS API token: access token
        AWSSecretToken:true // AWS API token: secret token
      }
    };

    gulp.task("gss", function()
    {
      gulp.src([path.join(__dirname, "/src/dirty/**")])
      .pipe(gss(opts))
      .pipe(gulp.dest(path.join(__dirname, "/out")));
    });

    assert.equal("gss" in gulp.tasks, true);

    return done();
  });


  it("should expose a function via the `require`", function(done)
  {
    assert.equal(typeof(gss), "function");
    return done();
  });


  it("should return a valid looking function when executed natively", function(done)
  {
    var g=gss();
    assert.equal(typeof(g), "object");
    assert.equal(typeof(g["_readableState"]), "object");
    assert.equal(typeof(g["_transformState"]), "object");
    assert.equal(typeof(g["readable"]), "boolean");
    assert.equal(typeof(g["writable"]), "boolean");

    return done();
  });

});
