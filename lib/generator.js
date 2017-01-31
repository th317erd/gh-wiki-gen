(function(factory) {
  module.exports = factory(require('devoir'));
})(function(D) {
  function Block() {
    this.chunks = [];
  }

  Block.prototype = {
    command: function(name, callback) {
      this['_' + name] = function() {
        var block = this.newBlock(this.context);
        var ret = callback.bind(block, block.context).apply(block, arguments);
        return (ret instanceof Block) ? ret : block;
      };
    },
    run: function(name) {
      var funcName = '_' + name;
      if (!(funcName in this))
        return;

      var args = new Array(arguments.length - 1);
      for (var i = 1, il = arguments.length; i < il; i++)
        args[i - 1] = arguments[i];

      var ret = this[funcName].apply(this, args);
      this.write(ret);

      return ret;
    },
    each: function(key, callback, sortFunc) {
      var context = this.context[key];
      if (!context)
        return;

      if (context instanceof Array && sortFunc instanceof Function)
        context = context.slice().sort(sortFunc);

      var keys = Object.keys(context);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            val = context[key];

        this.write(this.newBlock(val, callback));
      }
    },
    newPage: function(_name, _callback, _context) {
      var name = _name,
          callback = _callback,
          context = _context;

      if (!context)
        context = this.context;

      if (name instanceof Function) {
        callback = name;
        name = this.pageName(context);
        if (this.defaultPageExt)
          name = name + '.' + this.defaultPageExt;
      }

      var block = this.newBlock(context),
          stream;

      if (!(stream = this._streams[name])) {
        try {
          var fileName = path.join(this.generator.path, name);
          console.log('Generating page ' + fileName + '...');
          stream = fs.createWriteStream(fileName);
          this._streams[name] = stream;
          stream.setDefaultEncoding('utf8');
        } catch(e) {
          console.error(e);
          return;
        }
      }

      block.stream = stream;
      callback.call(block, context);
      stream.on('beforeClose', function() {
        stream.write('' + block);
      });

      return block;
    },
    currentPage: function() {
      var block = this;
      while(block.parent) {
        if (block.hasOwnProperty('stream'))
          return block;
        block = block.parent;
      }
      return block;
    },
    contextPathToFileName: function(path) {
      var newPath = path.replace(/\W+/g, '_');
      return D.utils.prettify(newPath);
    },
    pageName: function(_context) {
      var context = _context;

      if (!context)
        context = this.context;

      var path = context.getPath();
      return this.contextPathToFileName(path);
    },
    anchor: function(_context) {
      var context = _context;
      if (!context)
        context = this.context;

      var hash = [],
          pageName = this.pageName(context);

      if (context.static)
        hash.push('static');

      if (context.type)
        hash.push(context.type);

      hash.push(context.name);

      return {
        hash: hash.join('-'),
        name: context.name
      };
    },
    depth: function() {
      var context = this,
          d = 0;

      while(context.parent) {
        if (context.hasOwnProperty('stream'))
          break;
        d++;
        context = context.parent;
      }

      return d;
    },
    newBlock: function(_context, _callback) {
      var context = _context,
          callback = _callback;

      if (context instanceof Function) {
        callback = context;
        context = this.context;
      }

      var block = Object.create(this);
      Block.call(block);
      block.context = context;
      block.parent = this;
      block.super = this;

      if (callback instanceof Function)
        callback.call(block, context);

      return block;
    },
    referenceURL: function(contextPath, name) {
      var context = this.getRootBlock().context.getContextFromPath(contextPath);
      if (!context) {
        console.warn('Warning: No context found for: ', contextPath);
        return '';
      }

      var pageName = this.pageName(context);

      if (!pageName)
        return '';

      /*if (this.defaultPageExt)
        pageName = pageName + '.' + this.defaultPageExt;*/

      var linkName = (name) ? name : contextPath,
          anchor = this.anchor(context);

      return '<a href="' + pageName.replace(/\s/g,'+') + '#' + anchor.hash + '">' + linkName + '</a>';
    },
    write: function(chunk) {
      this.chunks.push(chunk);
    },
    getContextFromPath: function(contextPath) {
      var context = this.getRootBlock().context.getContextFromPath(contextPath);
      if (!context) {
        console.warn('Warning: No context found for: ', contextPath);
        return '';
      }

      return context;
    },
    getRootBlock: function() {
      var block = this;
      while(block.parent)
        block = block.parent;
      return block;
    },
  	toString: function() {
      var str = this.chunks.join('');
      if (this.hasOwnProperty('postProcess') && this.postProcess instanceof Function)
        str = this.postProcess.call(this, str);

  		return str;
  	}
  };

  function Generator() {}

  Generator.prototype = {
    writePropertyHeader: function(stream, context) {
      var anchor = this.getAnchor(context),
          parentBlock = this.getReferenceBlock(context.parent);

      stream.write('### ');
      stream.write('<a name="' + anchor + '"></a>');

      if (context.static)
        stream.write('static ');

      stream.write('property ');
      stream.write(context.parent + '.' + context.name);
      stream.write('\n\n');
    },
    writeProperty: function(stream, context) {
      stream.write('> #### Description\n');
      stream.write(this.formatDescription(context.desc).replace(/^\s*/gm, '> '));

      stream.write('\n\n---\n\n');
    },
    writeBlock: function(stream, context) {
      if (context.type === 'function') {
        this.writeFunctionHeader(stream, context);
        this.writeFunction(stream, context);
      } else if (context.type === 'property') {
        this.writePropertyHeader(stream, context);
        this.writeProperty(stream, context);
      }
    },
    generatePage: function(fileName, context, rootBlock) {
      var self = this;

      return new D.Deferred(function(resolve, reject) {
        try {
          var stream = fs.createWriteStream(fileName);
          stream.setDefaultEncoding('utf8');
          
          rootBlock.start(context.type);

          context.traverse(function(context, depth) {
            if (depth > 1)
              return;

            console.log('Would write:', context.name);
            var blockFunc = rootBlock[context.type];
            if (blockFunc instanceof Function)
              blockFunc(context);
          });

          rootBlock.end();

          stream.write(rootBlock.toString());
          stream.end();  
        } catch(e) {
          console.error(e);
          reject(e);
        }
      });
    },
    generatePages: function(rootBlock, docData) {
      if (!docData)
        return;

      var self = this,
          deferreds = [],
          pages = {};

      docData.traverse(function(context) {
        var pageName = self.makePageFileName(context);
        if (pages[pageName])
        	return;

        pages[pageName] = pageName;
        var fullPath = path.join(self.path, pageName);

        console.log('Generating page (n stuff):', fullPath);
        deferreds.push(self.generatePage(fullPath, context, rootBlock));
      });

      if (deferreds.length > 0)
        return D.Deferred.all(deferreds);
      else
        return D.Deferred.resolve();
    },
    generateSideBar: function(rootBlock, docData) {
      var self = this;
      return new D.Deferred(function(resolve, reject) {
        try {
          var stream = fs.createWriteStream(path.join(self.path, '_Sidebar.md'));
          stream.setDefaultEncoding('utf8');
          
          self.traverseBlocks(docData, function(context, key, depth) {
            stream.write(new Array((depth * 2) + 1).join(' ') + '* ');
            stream.write(self.getReferenceURL(context.path, true));
            stream.write('\n');
          });

          stream.end();  
        } catch(e) {
          reject(e);
        }
      });
    },
    generateFooter: function(rootBlock, docData) {

    },
    createRootBlock: function(docData) {
      return new Block('root');
    },
    generate: function(outputPath, docData) {
      if (!docData)
        return D.Deferred.reject('No document data object provided');

      console.log('Generating...');

      this.path = outputPath;
      this.docData = docData;

      var rootBlock = this.createRootBlock(docData);
      rootBlock.generator = this;
      rootBlock.context = docData;
      rootBlock._streams = {};

      rootBlock.run(docData.type);

      var streams = rootBlock._streams,
          keys = Object.keys(streams);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            stream = streams[key];
        stream.emit('beforeClose');
        stream.end();
      }

      try {
        fs.writeFileSync(path.join(this.path, 'docs.json'), JSON.stringify(docData, function(key, value) {
          if (key === 'parent')
            return undefined;
          return value;
        }, 2));  
      } catch(e) {
        console.log('Warning: Unable to write docs.json: ', e);
      }

      return D.Deferred.resolve();
    }
  };

  var fs = require('fs'),
      path = require('path');

  Generator.Block = Block;

  return Generator;
});