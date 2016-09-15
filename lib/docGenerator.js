(function(factory) {
	module.exports = factory({}, require('devoir'));
})(function(root, D) {
	function keyPathToFileName(path) {
		var newPath = path.replace(/\.(\w)/g, function(match, p) {
			return ' ' + p.toUpperCase();
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
		traverseBlocks: function(docData, callback) {
			function doTraverse(docData, _depth) {
				if (!docData)
					return;

				var depth = _depth || 0,
						keys = Object.keys(docData);

				for (var i = 0, il = keys.length; i < il; i++) {
					var key = keys[i],
							d = docData[key];

					if (key === 'parentBlock' || alreadyVisited.indexOf(d) >= 0)
						continue;

					var isBlock = this.isDocBlock(d);
					alreadyVisited.push(d);

					if (isBlock)
						callback.call(this, d, key, depth);
					
					if (!D.utils.instanceOf(d, 'string', 'boolean', 'number', 'array', 'function') && d instanceof Object)
						doTraverse.call(this, d, (isBlock) ? (depth + 1) : depth);
				}
			}

			var alreadyVisited = [];
			if (!(callback instanceof Function))
				return;
		
			return doTraverse.call(this, docData, 0);
		},
		getAnchor: function(block) {
			return block.name;
		},
		makePageFileName: function(block) {
			return keyPathToFileName((block.type === 'method' && block.parent) ? block.parent : block.path) + '.md';
		},
		writePageHeader: function(stream, block) {
			var anchor = this.getAnchor(block);
			stream.write('## ');
			stream.write('<a name="' + anchor + '"></a>');
			stream.write(block.path);
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
			stream.write('### ');
			stream.write('<a name="' + anchor + '"></a>function ');
			stream.write(block.parent + '.' + block.name);
			this.writeMethodArguments(stream, block);
			stream.write('\n\n');
		},
		getReferenceURL: function(blockPath, onlyLast) {
			var block = D.prop(this.docData, 'get', blockPath);
			if (!block)
				return '';

			var page = this.makePageFileName(block);
			if (!page)
				return '';

			var name = blockPath,
					anchor = this.getAnchor(block);

			if (onlyLast)
				name = block.name;

			return '<a href="' + (page.replace(/\.\w+$/,'').replace(/\s/g,'+')) + '#' + anchor + '">' + name + '</a>';
		},
		formatDescription: function(desc) {
			var self = this;
			return desc.trim().replace(/@@@(\S+)@@@/g, function(match, p) {
				return self.getReferenceURL(p);
			});
		},
		writeMethod: function(stream, block) {
			var args = block.arguments;

			if (args && args.length > 0) {
				stream.write('> #### Parameters');

				for (var i = 0, il = args.length; i < il; i++) {
					var arg = args[i];					
					if (arg.optional)
						continue;

					stream.write('\n> * **');
					stream.write(arg.name);
					stream.write('** *(');
					stream.write(arg.dataTypes.join(', '));
					stream.write(')*<br>\n');
					stream.write(this.formatDescription(arg.desc).replace(/^\s*/gm, '>   '));
				}

				for (var i = 0, il = args.length; i < il; i++) {
					var arg = args[i];					
					if (!arg.optional)
						continue;

					stream.write('\n> * **');
					stream.write(arg.name);
					stream.write('** <i>(');
					stream.write(arg.dataTypes.join(', '));
					stream.write(')</i><br>\n');

					stream.write('>   Optional. ' + this.formatDescription(arg.desc).replace(/\n\s*/gm, '\n>   '));

					if (arg.defaultValue) {
						stream.write('<br><br>\n>   *Default value = ');
						stream.write(arg.defaultValue);
						stream.write('*');
					}
				}

				stream.write('\n>\n');
			}

			var r = block['return'];
			if (r) {
				stream.write('> #### Return value\n');
				stream.write('> * **return** <i>(');
				stream.write(r.dataTypes.join(', '));
				stream.write(')</i><br>\n');
				stream.write(this.formatDescription(r.desc).replace(/^\s*/gm, '>   '));
			} else {
				stream.write('\n> #### Return value is not defined');
			}

			stream.write('\n>\n');
			
			stream.write('> #### Description\n');
			stream.write(this.formatDescription(block.desc).replace(/^\s*/gm, '> '));
			stream.write('\n>\n');

			var notes = block.notes;
			if (notes && notes.length > 0) {
				stream.write('> #### Notes\n');
				for (var i = 0, il = notes.length; i < il; i++) {
					var note = notes[i];
					stream.write('\n> * ');
					stream.write(note);
				}

				stream.write('\n>\n');
			}

			var seeAlso = block.see;
			if (seeAlso && seeAlso.length > 0) {
				stream.write('> #### See Also\n');
				for (var i = 0, il = seeAlso.length; i < il; i++) {
					var see = seeAlso[i];
					stream.write('\n> * ');
					stream.write(this.getReferenceURL(see));
				}

				stream.write('\n>\n');
			}

			var examples = block.examples;
			if (examples && examples.length > 0) {
				stream.write('> #### Examples');
				for (var i = 0, il = examples.length; i < il; i++) {
					var example = examples[i];
					stream.write('\n> ```');
					stream.write(example.type);
					stream.write('\n');
					stream.write(example.desc.trim().replace(/^/gm, '> '));
					stream.write('\n> ```');
				}

				stream.write('\n>\n');
			}

			stream.write('\n\n---\n\n');
		},
		generatePage: function(fileName, docData) {
			var self = this;

			return new D.Deferred(function(resolve, reject) {
				try {
					var stream = fs.createWriteStream(fileName);
					stream.setDefaultEncoding('utf8');
					
					self.writePageHeader(stream, docData);

					self.traverseBlocks(docData, function(block, key, depth) {
						if (block.type !== 'method')
							return;

						if (block.parentBlock) {
							if (block.parentBlock.type !== 'method' && depth > 0)
								return;
							else if (block.parentBlock.type === 'method' && depth > 1)
								return;
						} else if (depth > 0)
							return;

						self.writeMethodHeader(stream, block);
						self.writeMethod(stream, block);
					});

					stream.end();	
				} catch(e) {
					reject(e);
				}
			});
		},
		generatePages: function(docData) {
			if (!docData)
				return;

			var self = this,
					deferreds = [];

			this.traverseBlocks(docData, function(block) {
				if (block.type === 'method')
					return;

				var pageName = self.makePageFileName(block);
				deferreds.push(self.generatePage(path.join(self.path, pageName), block));
			});

			if (deferreds.length > 0)
				return D.Deferred.all(deferreds);
			else
				return D.Deferred.resolve();
		},
		generateSideBar: function(docData) {
			var self = this;
			return new D.Deferred(function(resolve, reject) {
				try {
					var stream = fs.createWriteStream(path.join(self.path, '_Sidebar.md'));
					stream.setDefaultEncoding('utf8');
					
					self.traverseBlocks(docData, function(block, key, depth) {
						stream.write(new Array((depth * 2) + 1).join(' ') + '* ');
						stream.write(self.getReferenceURL(block.path, true));
						stream.write('\n');
					});

					stream.end();	
				} catch(e) {
					reject(e);
				}
			});
		},
		generateFooter: function(docData) {

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

			return D.Deferred.all(deferreds);
		}
	};

	var fs = require('fs'),
      path = require('path');

	root.DocGenerator = DocGenerator;

	return root;
});