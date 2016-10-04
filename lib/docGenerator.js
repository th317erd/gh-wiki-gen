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

					if (isBlock && callback.call(this, d, key, depth) === false)
						return false;
					
					if (!D.utils.instanceOf(d, 'string', 'boolean', 'number', 'function') && (d instanceof Object)) {
						if (doTraverse.call(this, d, (isBlock) ? (depth + 1) : depth) === false)
							return false;
					}
				}
			}

			var alreadyVisited = [];
			if (!(callback instanceof Function))
				return;
		
			return doTraverse.call(this, docData, 0);
		},
		getAnchor: function(block) {
			var name = [];

			if (block.static)
				name.push('static');

			name.push(block.name);

			return name.join('-');
		},
		makePageFileName: function(block, noExt) {
			var fileName = keyPathToFileName(block.path.replace(/\.functions(\[\d*\])?/g, ''));
			if (noExt !== true)
				fileName = fileName + '.md';
			return fileName;
		},
		writePageHeader: function(stream, block) {
			var anchor = this.getAnchor(block);
			stream.write('## ');
			stream.write('<a name="' + anchor + '"></a>');

			if (block.type === 'class')
				stream.write('Class ');
			else if (block.type === 'namespace')
				stream.write('Namespace ');

			stream.write(block.path);
			stream.write('\n\n');
		},
		writeFunctionArguments: function(stream, block) {
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
		writeFunctionHeader: function(stream, block) {
			var anchor = this.getAnchor(block),
					parentBlock = this.getReferenceBlock(block.parent);

			stream.write('### ');
			stream.write('<a name="' + anchor + '"></a>');

			if (block.static)
				stream.write('static ');
			else if (parentBlock.type === 'class')
				stream.write('member ');

			stream.write('function ');
			stream.write(block.parent + '.' + block.name);
			this.writeFunctionArguments(stream, block);
			stream.write('\n\n');
		},
		getReferenceBlock: function(reference) {
			var referenceBlock = D.get(this.docData, reference);

			if (referenceBlock)
				return referenceBlock;

			this.traverseBlocks(this.docData, function(block) {
				if (!block.parent && !block.name)
					return;

				var parts = [];
				if (block.parent)
					parts.push(block.parent);

				if (block.name)
					parts.push(block.name);

				if (parts.join('.') === reference) {
					referenceBlock = block;
					return false;
				}
			});

			return referenceBlock;
		},
		getReferenceURL: function(blockPath, onlyLast) {
			var block = this.getReferenceBlock(blockPath);
			if (!block) {
				console.warn('Warning: No block found for: ', blockPath);
				return '';
			}

			var page = this.makePageFileName(block, true);
			if (!page)
				return '';

			var name = blockPath,
					anchor = this.getAnchor(block);

			if (onlyLast)
				name = block.name;

			return '<a href="' + page.replace(/\s/g,'+') + '#' + anchor + '">' + name + '</a>';
		},
		formatDescription: function(desc) {
			var self = this;
			return desc.trim().replace(/@@@(\S+)@@@/g, function(match, p) {
				return self.getReferenceURL(p);
			});
		},
		writeFunction: function(stream, block) {
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
					stream.write(this.formatDescription(arg.desc).replace(/^/gm, '>   '));
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

					stream.write('>   Optional. ' + this.formatDescription(arg.desc).replace(/\n/gm, '\n>   '));

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
		writePropertyHeader: function(stream, block) {
			var anchor = this.getAnchor(block),
					parentBlock = this.getReferenceBlock(block.parent);

			stream.write('### ');
			stream.write('<a name="' + anchor + '"></a>');

			if (block.static)
				stream.write('static ');

			stream.write('property ');
			stream.write(block.parent + '.' + block.name);
			stream.write('\n\n');
		},
		writeProperty: function(stream, block) {
			stream.write('> #### Description\n');
			stream.write(this.formatDescription(block.desc).replace(/^\s*/gm, '> '));

			stream.write('\n\n---\n\n');
		},
		writeBlock: function(stream, block) {
			if (block.type === 'function') {
				this.writeFunctionHeader(stream, block);
				this.writeFunction(stream, block);
			} else if (block.type === 'property') {
				this.writePropertyHeader(stream, block);
				this.writeProperty(stream, block);
			}
		},
		generatePage: function(fileName, docData) {
			var self = this;

			return new D.Deferred(function(resolve, reject) {
				try {
					var stream = fs.createWriteStream(fileName);
					stream.setDefaultEncoding('utf8');
					
					self.writePageHeader(stream, docData);

					self.traverseBlocks(docData, function(block, key, depth) {
						if (depth > 0)
							return;

						self.writeBlock(stream, block);
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
				if (block.type === 'function')
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

			try {
				fs.writeFileSync(path.join(this.path, 'docs.json'), JSON.stringify(docData, function(key, value) {
					if (key === 'parent')
						return undefined;
					return value;
				}, 2));	
			} catch(e) {
				console.log('Warning: Unable to write docs.json: ', e);
			}

			return D.Deferred.all(deferreds);
		}
	};

	var fs = require('fs'),
      path = require('path');

	root.DocGenerator = DocGenerator;

	return root;
});