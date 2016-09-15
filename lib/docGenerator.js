(function(factory) {
	module.exports = factory({}, require('devoir'));
})(function(root, D) {
	function keyPathToFileName(path) {
		var newPath = path.replace(/\.(\w)/g, function(match, p) {
			return p.toUpperCase();
		});
		return D.utils.prettify(newPath);
	}

	function DocGenerator() {

	}

	DocGenerator.prototype = {
		isDocBlock: function(docData) {
			if (!docData)
				return false;

			if (docData.block)
				return true;

			return false;
		},
		fetchDocBlocks: function(docData, matcher) {
			function doFetch(docData, matcher, _items, _depth) {
				if (!docData)
					return [];

				var items = _items || [],
						depth = _depth || 0,
						keys = Object.keys(docData);

				for (var i = 0, il = keys.length; i < il; i++) {
					var key = keys[i],
							d = docData[key];

					if (!D.utils.instanceOf(d, 'string', 'boolean', 'number', 'array', 'function') && d instanceof Object)
						doFetch.call(this, d, matcher, items, depth + 1);

					if (!this.isDocBlock(d))
						continue;

					if (matcher instanceof Function && matcher.call(this, key, d, depth) === false)
						continue;

					items.push(d);
				}

				return items;
			}
		
			return doFetch.call(this, docData, matcher).sort(function(a, b) {
				var x = a.name,
						y = b.name;

				return (x == y) ? 0 : (x < y) ? -1 : 1;
			});
		},
		getAnchor: function(block) {
			return block.name;
		},
		makePageFileName: function(block) {
			return keyPathToFileName(block.path) + '.md';
		},
		writePageHeader: function(stream, block) {
			stream.write('## ');
			stream.write(block.name);
			stream.write('\n\n');
		},
		writeMethodArguments: function(stream, block) {
			stream.write('(');
			var args = block.arguments;
			if (args && args.length > 0) {
				var argCount = 0, optionalArgCount = 0;
				for (var i = 0, il = args.length; i < il; i++) {
					var arg = args[i];					
					if (arg.optional) {
						optionalArgCount++;
						continue;
					}

					if (argCount > 0)
						stream.write(', ');

					argCount++;
					stream.write(arg.name);
				}

				for (var i = 0, il = args.length; i < il; i++) {
					var arg = args[i];					
					if (!arg.optional)
						continue;

					stream.write('[');
					if (argCount > 0)
						stream.write(', ');

					argCount++;
					stream.write('<i>' + arg.name + '</i>');	
				}

				if (optionalArgCount > 0)
					stream.write(new Array(optionalArgCount + 1).join(']'));
			}
			stream.write(')');
		},
		writeMethodHeader: function(stream, block) {
			var anchor = this.getAnchor(block);
			stream.write('### function ');
			stream.write('<a name="' + anchor + '"></a>');
			stream.write(block.parent + '.' + block.name);
			this.writeMethodArguments(stream, block);
			stream.write('\n\n');
		},
		formatDescription: function(desc) {
			var self = this;
			return desc.trim().replace(/@@@(\S+)@@@/g, function(match, p) {
				var block = D.prop(self.docData, 'get', p);
				if (!block)
					return '';

				var parentBlock = D.prop(self.docData, 'get', block.parent);
				if (!parentBlock)
					return '';

				var page = self.makePageFileName(parentBlock);
				if (!page)
					return '';

				var anchor = self.getAnchor(block);
				return '<a href="' + page + '#' + anchor + '">' + p + '</a>';
			});
		},
		writeMethod: function(stream, block) {
			var args = block.arguments;
			if (args && args.length > 0) {
				stream.write('> #### Parameters\n');

				for (var i = 0, il = args.length; i < il; i++) {
					var arg = args[i];					
					if (arg.optional)
						continue;

					stream.write('> * **');
					stream.write(arg.name);
					stream.write('** *(');
					stream.write(arg.dataTypes.join(', '));
					stream.write(')*<br>\n');
					stream.write(this.formatDescription(arg.desc).replace(/^\s*/gm, '>   '));
					stream.write('\n');
				}

				for (var i = 0, il = args.length; i < il; i++) {
					var arg = args[i];					
					if (!arg.optional)
						continue;

					stream.write('> * **');
					stream.write(arg.name);
					stream.write('** <i>(');
					stream.write(arg.dataTypes.join(', '));
					stream.write(')</i><br>\n');

					stream.write('>   Optional. ' + this.formatDescription(arg.desc).replace(/\n\s*/gm, '\n>   '));

					if (arg.defaultValue) {
						stream.write('<br><br>\n>   *Default value = ');
						stream.write(arg.defaultValue);
						stream.write('*\n');
					} else {
						stream.write('\n');
					}
				}
			}

			var r = block['return'];
			if (r) {
				stream.write('> #### Return value\n');
				stream.write('> * **return** <i>(');
				stream.write(r.dataTypes.join(', '));
				stream.write(')</i><br>\n');
				stream.write(this.formatDescription(r.desc).replace(/^\s*/gm, '>   '));
				stream.write('\n');	
			} else {
				stream.write('> #### Return value is not defined\n');
			}
			
			stream.write('> #### Description\n');
			stream.write(this.formatDescription(block.desc).replace(/^\s*/gm, '> '));
			stream.write('\n');

			var notes = block.notes;
			if (notes && notes.length > 0) {
				stream.write('> #### Notes\n');
				for (var i = 0, il = notes.length; i < il; i++) {
					var note = notes[i];
					stream.write('> * ');
					stream.write(note);
					stream.write('\n');
				}
			}

			var examples = block.examples;
			if (examples && examples.length > 0) {
				stream.write('> #### Examples\n');
				for (var i = 0, il = examples.length; i < il; i++) {
					var example = examples[i];
					stream.write('> ```');
					stream.write(example.type);
					stream.write('\n');
					stream.write(example.desc.trim().replace(/^/gm, '> '));
					stream.write('\n> ```\n');
				}
			}

			stream.write('\n\n---\n\n');
		},
		generatePage: function(fileName, docData) {
			var self = this;
			return new D.Deferred(function(resolve, reject) {
				var methods = self.fetchDocBlocks(docData, function(key, block, depth) {
					if (depth > 0)
						return false;

					return !!('' + block.type).match(/(method)/);
				});

				try {
					var stream = fs.createWriteStream(fileName);
					stream.setDefaultEncoding('utf8');
					
					self.writePageHeader(stream, docData);

					for (var i = 0, il = methods.length; i < il; i++) {
						var block = methods[i];
						self.writeMethodHeader(stream, block);
						self.writeMethod(stream, block);	
					}

					stream.end();	
				} catch(e) {
					reject(e);
				}
			});
		},
		generatePages: function(docData) {
			if (!docData)
				return;

			var deferreds = [],
					pages = this.fetchDocBlocks(docData, function(key, block) {
						return !!('' + block.type).match(/(class|namespace)/);
					});

			for (var i = 0, il = pages.length; i < il; i++) {
				var block = pages[i],
						pageName = this.makePageFileName(block);
				deferreds.push(this.generatePage(path.join(this.path, pageName), block));
			}

			if (deferreds.length > 0)
				return D.Deferred.all(deferreds);
			else
				return D.Deferred.resolve();
		},
		generateSideBar: function() {

		},
		generateFooter: function() {

		},
		generate: function(outputPath, docData) {
			if (!docData)
				return D.Deferred.reject('No document data object provided');

			this.path = outputPath;
			this.docData = docData;

			var deferreds = [];
			deferreds.push(this.generatePages(docData));
			deferreds.push(this.generateSideBar(docData));
			deferreds.push(this.generateFooter(docData));

			fs.writeFileSync(path.join(this.path, 'out.json'), JSON.stringify(docData, undefined, 2), 'utf8')

			return D.Deferred.all(deferreds);
		}
	};

	var fs = require('fs'),
      path = require('path');

	root.DocGenerator = DocGenerator;

	return root;
});