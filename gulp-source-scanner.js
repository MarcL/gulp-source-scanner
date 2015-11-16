// Deps
// Core
var path=require("path");
var fs=require("fs");

// 3rd party
var through2=require("through2");
var gu=require("gulp-util");

// "Private"
var pluginName=require(path.join(__dirname, "/package.json")).name;

var defaultOpts=
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

// Note: these MUST be arranged from most to least severe to enable log level checking - most severe first
var logLevelColours=
{
  "error":gu.colors.red.bold.bgBlack,
  "warn":gu.colors.magenta.bgBlack,
  "info":gu.colors.green.bgBlack,
  "debug":gu.colors.white.bgBlack
};

var logLevel="warn";

// A very simple logging function which uses gulp-util
function log(level, message)
{
  if(Object.keys(logLevelColours).indexOf(level)!==-1)
  {
    if(message)
    {
      if(Object.keys(logLevelColours).indexOf(level) <= Object.keys(logLevelColours).indexOf(logLevel))
      {
        gu.log(logLevelColours[level](message));
      }
    }
    else
    {
      throw new gu.PluginError(pluginName, "Empty log message received", {showStack: true});
    }
  }
  else
  {
    throw new gu.PluginError(pluginName, "Invalid log level used", {showStack: true});
  }
}

// scanType -> regex map
var scanTypeToRegexMap=
{
  RSAPublic:/-----BEGIN CERTIFICATE-----/,
  RSAPrivate:/-----BEGIN RSA PRIVATE KEY-----/,
  AWSAccessToken:/(\s|^)[A-Z0-9]{20}(?![A-Z0-9])(\s|$)/,

  // Issue with this in that it matches RSA private keys too
  AWSSecretToken:/(\s|^)[A-Za-z0-9/+=]{40}(\s|$)/
};

// "Public"
function scan(opts)
{
  // Default for opts if not supplied or likely incorrect
  if(!(opts instanceof Object))
  {
    opts=defaultOpts;
  }


  if(typeof(opts.logLevel)==="string")
  {
    logLevel=opts.logLevel;
  }

  var restoreStream=through2.obj();

  return through2.obj(function scanFn(file, encoding, callback)
  {
    var err=[];

    // Detect null file types, unlikely this'd be needed here but included for completeness
    if(file.isNull())
    {
      return callback(null, file);
    }
    // Detect stream usage and throw if detected
    else if(file.isStream())
    {
      throw new gu.PluginError(pluginName, "Streams are not currently supported", {showStack: true});
    }
    else if(file.isBuffer())
    {
      log("info", "Scanning file "+file.path);

      // We will respect .gitignore (and maybe more in future) ignore files
      var ignore=false;

      if(opts.ignoreFilesListLocation===false)
      {
        log("debug", "Bypassing ignoreFilesListLocation due to options received");
      }
      else // we have an ignoreFile so will try to use it
      {
        var ignoreFileContent=null;
        if(opts.ignoreFilesListLocation!==false)
        {
          // perhaps should use path.resolve here? would allow people to use abs urls i guess
          var ignoreFile=path.join(process.cwd(), "/", opts.ignoreFilesListLocation);

          ignoreFileContent=fs.readFileSync(ignoreFile);
        }

        if(ignoreFileContent)
        {
          var ignoreFileContentArray=String(ignoreFileContent).replace("\r\n", "\n").split("\n");
          var absoluteIgnorePath;

          // Iterate through the ignore file content (one line per ignore rule)
          for(var i in ignoreFileContentArray)
          {
            // This if simply bypasses the empty entry in the array caused by a trailing newline
            // char in the ignore file or empty lines and also ignores comments
            if(ignoreFileContentArray[i] && ignoreFileContentArray[i].trim()[0]!=="#")
            {
              // Create an absolute path for the ignore file entry
              absoluteIgnorePath=path.join(process.cwd(), "/", ignoreFileContentArray[i]);

              // Test to see if the ignore entry matches file.path as a dir(+ content) or an absolite match
              if(new RegExp(absoluteIgnorePath+"/.+").test(file.path) || absoluteIgnorePath===file.path)
              {
                ignore=true;
              }

              log("debug", (ignore?"I":"Not i")+"gnoring "+file.path);
            }
          }
        }
        else
        {
          log("debug", "No ignore file content found");
        }
      }

      if(ignore===false)
      {
        if(opts.ignoreFilesLargerThanMB>(file.stat.size/1024) || opts.ignoreFilesLargerThanMB===0)
        {
          // Execute all defined scanTypes in opts
          if("scanTypes" in opts)
          {
            var scanTypeRegex=null;

            var fileExtension=path.extname(file.path);

            log("debug", "Detected file extension "+fileExtension);

            for(var i in opts.scanTypes)
            {
              // If configured to scan this scanType by either being set to true or a matching filename extension
              if(opts.scanTypes[i]===true || opts.scanTypes[i]===fileExtension || opts.scanTypes[i].indexOf(fileExtension)!==-1)
              {
                log("debug", "Testing for "+i+" data in contents since file extension ("+fileExtension+") matches "+opts.scanTypes[i]);

                scanTypeRegex=scanTypeToRegexMap[i];

                if(scanTypeRegex)
                {
                  // Test for matching file content
                  if(scanTypeRegex.test(String(file.contents)))
                  {
                    log("error", "File "+file.path+" looks like it contains "+i+" format data");
                    err.push("File "+file.path+" looks like it contains "+i+" format data");
                  }
                  else
                  {
                    log("debug", "File does not appear to contain "+i+" data");
                    // restoreStream.write(file);
                  }
                }
                else
                {
                  log("error", "Couldn't find a regular expression to test file against");
                }
              }
              else
              {
                log("debug", "Not scanning this file for "+i+" due to options received");
              }
            }

            // If we have >=1 match for this file...
            if(err.length)
            {
              // .. and if the user has opted to fail the gulp task on error...
              if(opts.failOnDetection===true)
              {
                log("error", "Failing gulp task now due to options received");
                // ...throw an error, this will result in gulp exiting with return code 1
                throw new Error(err.toString());
              }
              else
              {
                // ...otherwise, set `err` to `null` so that gulp will continue...
                err=null;

                // ...and (if configured) also nullify the file so that it doesn't get passed to the output of gulp
                if(opts.removeFilesFromOutput==="non-matches")
                {
                  log("debug", "Removing file from output due to options received");
                  file=null;
                }
              }
            }
            else
            {
              // ...otherwise, set `err` to `null` so that we are explicit that there's no error...
              err=null;

              // ...and (if configured) also nullify the file so that it doesn't get passed to the output of gulp
              if(opts.removeFilesFromOutput==="matches")
              {
                log("debug", "Removing file from output due to options received");
                file=null;
              }
            }

            // If we have go here (i.e. we haven't thrown an error), return the callback in normal gulp style
            return callback(err, file);
          }
          else
          {
            log("error", "No `scanTypes` property found in opts object");
          }
        }
        else
        {

// prob need to add conditions here for whether we're filtering output
          log("warn", "Ignoring file "+file.path+" as it's larger than "+opts.ignoreFilesLargerThanMB+"MB");
          return callback(null, file);
        }
      }
      else
      {
// prob need to add conditions here for whether we're filtering output
        log("info", "Ignoring "+file.path+" due to "+opts.ignoreFilesListLocation);
        return callback(null, file);
      }
    }
  });
};

module.exports=scan;
