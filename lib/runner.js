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
    parseData: function(fileName, source) {
      var parser = this.options.parser;

      console.log('Reading file ' + fileName);
      var tokens = parser.parseFile(fileName, source);
      if (!tokens)
        return;

      parser.source = source;
      parser.fileName = fileName;

      var c = 0,
          context = parser.createGlobalContext(),
          globalContext = context;

      for (var i = 0, il = tokens.length; i < il; i++) {
        var token = tokens[i];
        if (token.type === 'Block') {
          c++;
          context = parser.parseBlock(context, token.value);
          
          if (c > 5)
            break;
        }
      }

      return globalContext;
    },
    parseFile: function parseFile(fileName) {
      var self = this;
      return new D.Deferred(function(resolve, reject) {
        fs.readFile(fileName, 'utf8', function(err, source) {
          if (err) {
            console.log('Error: ', err);
            reject(err);
            return;
          }

          resolve({name: fileName, data: self.parseData(fileName, source)});
        });
      });
    },
    parseFiles: function parse(files) {
      var fileDeferreds = [];
      for (var i = 0, il = files.length; i < il; i++) {
        var fileName = files[i];
        fileDeferreds.push(this.parseFile(fileName));
      }

      return D.Deferred.all(fileDeferreds);
    },
    parse: function() {
      var self = this,
          inputPath = this.options.inputPath,
          files = [];

      var defaultParser = require('./docParser');

      if (!inputPath)
        inputPath = path.resolve();

      var parser = this.options.parser;
      if (!parser) {  
        parser = new defaultParser.DocParser();
      } else if (typeof parser === 'string' || parser instanceof String) {
        parser = require(parser)(this.options, defaultParser, D);
        if (parser instanceof Function)
          parser = new parser();
      }

      this.options.parser = parser;

      if (!this.options.generator) {
        var defaultGenerator = require('./docGenerator');
        this.options.generator = new defaultGenerator.DocGenerator();
      }

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

      return self.parseFiles(files).then(function() {
        var output = arguments[0];
        self.options.generator.generate(self.options.outputPath, output);
      }, function(error) {
        console.error(error);
      });
    }
  };

  var fs = require('fs'),
      path = require('path');

  root.Parser = Parser;

  return root;
});

