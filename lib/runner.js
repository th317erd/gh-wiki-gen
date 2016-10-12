(function(factory) {
  module.exports = function(_root, _D) {
    var root = _root || {},
        D = _D;
    
    if (!D)
      D = require('devoir');
    
    return factory(root, D);
  };
})(function(root, D) {
  "use strict";

  function walkDir(dir, action) {
    try {
      var list = fs.readdirSync(dir);
      list.forEach(function(file) {
        var fullPath = path.join(dir, file);
        var stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory())
          walkDir(fullPath, action);
        else if (action)
          action(null, fullPath);
      });
    } catch(e) {
      console.log('Error: ', e);
    }
  };

  function getRelativePath(inputPath, fileName) {
    var name = fileName.substring(inputPath.length);
    return name.replace(/^[/\\]+/,'');
  }

  function Parser(_opts) {
    var opts = _opts || {};
    this.options = opts;
  }

  var p = Parser.prototype = {
    isExcluded: function isExcluded(fileName) {
      function testMatch(fileName, patterns, ext) {
        if (!patterns || !patterns.length)
          return false;

        for (var i = 0, il = patterns.length; i < il; i++) {
          var pattern = patterns[i];

          if (ext) {
            if (pattern.charAt(pattern.length - 1))
              pattern += '$';

            if (pattern.charAt(0) !== '.')
              pattern = '\\.' + pattern;
          }

          if (fileName.match(new RegExp(pattern)))
            return true;
        }

        return false;
      }

      var include = this.options.include,
          exclude = this.options.exclude,
          extensions = this.options.extensions;

      if (include && include.length > 0 && testMatch(fileName, include) === false)
        return true;

      if (exclude && exclude.length > 0 && testMatch(fileName, exclude) === true)
        return true;

      if (extensions && extensions.length > 0 && testMatch(fileName, extensions, true) === false)
        return true;

      return false;
    },
    parseFile: function parseFile(parser, fileName) {
      var self = this;
      return new D.Deferred(function(resolve, reject) {
        fs.readFile(fileName, 'utf8', function(err, source) {
          if (err) {
            console.log('Error: ', err);
            reject(err);
            return;
          }

          resolve({name: fileName, data: parser.parse(fileName, source)});
        });
      });
    },
    parseFiles: function parse(parser, files) {
      var fileDeferreds = [];
      for (var i = 0, il = files.length; i < il; i++) {
        var fileName = files[i];
        fileDeferreds.push(this.parseFile(parser, fileName));
      }

      return D.Deferred.all(fileDeferreds);
    },
    parse: function() {
      function getParserGenerator(type, options, base) {
        var worker = type;
        if (!worker) {  
          worker = new base(options);
        } else if (typeof worker === 'string' || worker instanceof String) {
          worker = require(worker);
        }

        if (worker instanceof Function)
          worker = worker(options, base, D);

        return worker;
      }

      var self = this,
          inputPath = this.options.inputPath,
          files = [];

      var parserBase = require('./parser'),
          generatorBase = require('./generator');

      if (!inputPath)
        inputPath = path.resolve();

      var parser = this.options.parser = getParserGenerator(this.options.parser, this.options, parserBase);
      var generator = this.options.generator = getParserGenerator(this.options.generator, this.options, generatorBase);

      try {
        var docGenOpts = require(path.join(inputPath, 'docGen.js'));
        if (docGenOpts) {
          if (docGenOpts instanceof Function)
            docGenOpts = docGenOpts.call(this);

          if (docGenOpts instanceof Object)
            this.options = D.data.extend(docGenOpts, this.options);  
        }  
      } catch(e) {}
      
      this.options.inputPath = path.resolve(this.options.inputPath);
      this.options.outputPath = path.resolve(this.options.outputPath);

      console.log('Input path: ', this.options.inputPath);
      console.log('Output path: ', this.options.outputPath);

      //console.log("Options: ", this.options);

      walkDir(inputPath, function(err, fileName) {
        if (err)
          return;

        if (self.isExcluded(getRelativePath(inputPath, fileName)))
          return;

        files.push(fileName);
      });

      return self.parseFiles(parser, files).then(function() {
        //TODO: merge contexts
        var output = arguments[0];
        self.generate(generator, output.data);
      }, function(error) {
        console.error(error);
      });
    },
    generate: function(generator, data) {
      var outputPath = this.options.outputPath;
      generator.generate(outputPath, data);
    }
  };

  var fs = require('fs'),
      path = require('path');

  root.Parser = Parser;

  return root;
});

