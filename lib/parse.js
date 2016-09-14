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

  function getRelativePath(rootPath, fileName) {
    var name = fileName.substring(rootPath.length);
    return name.replace(/^[/\\]+/,'');
  }

  function getLine(source, offset) {
    return source.substring(0, offset).split(/\n/g).length;
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
      var parser = this.options.parser,
          parserBlockPattern = parser.blockPattern,
          parserBlockMatch = parser.blockMatch;

      if (!parserBlockPattern)
        parserBlockPattern = /\/\*\*([\s\S]*?)\*\//g;
      else if (parserBlockPattern instanceof Function)
        parserBlockPattern = parserBlockPattern.call(parser, fileName);

      if (!parserBlockMatch) {
        parserBlockMatch = function(val) {
          return val;
        };
      }

      var tokenizer = new D.utils.Tokenizer({
        skipWS: false,
        tokenTypes: {
          'Identifier': {
            order: 10,
            pattern: /([a-zA-Z][a-zA-Z0-9_]*)/g
          },
          'DocBlock': {
            order: 25,
            pattern: parserBlockPattern,
            success: parserBlockMatch
          }
        }
      });

      parser.fileName = fileName;
      parser.context = {};

      var tokens = tokenizer.parse(source),
          finalTokens = [];

      for (var i = 0, il = tokens.length; i < il; i++) {
        var token = tokens[i];
        if (token.type === 'DocBlock') {
          parser.line = getLine(source, token.offset);
          parser.block = token.value;
          parser.parseBlock(token.value);
        }
      }

      return finalTokens;
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
          rootPath = this.options.path,
          files = [],
          output = this.options.output || {};

      if (!rootPath)
        rootPath = path.resolve();

      if (!this.options.parser) {
        var defaultParser = require('./defaultDocParser');
        this.options.parser = new defaultParser.DocParser();
      }

      this.options.parser.output = output;

      try {
        var docGenOpts = require(path.join(rootPath, 'docGen.js'));
        if (docGenOpts) {
          if (docGenOpts instanceof Function)
            docGenOpts = docGenOpts.call(this);

          if (docGenOpts instanceof Object)
            this.options = D.data.extend(docGenOpts, this.options);  
        }  
      } catch(e) {}
      
      //console.log("Options: ", this.options);

      walkDir(rootPath, function(err, fileName) {
        if (err)
          return;

        if (self.isExcluded(getRelativePath(rootPath, fileName)))
          return;

        files.push(fileName);
      });

      return self.parseFiles(files).then(function() {
        console.log('Output: ', output.devoir.utils);
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

