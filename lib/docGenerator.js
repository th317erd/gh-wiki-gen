(function(factory) {
	module.exports = factory({}, require('devoir'));
})(function(root, D) {
	function keyPathToFileName(path) {
		var newPath = path.replace(/\W+/g, '_');
		return D.utils.prettify(newPath);
	}

	function DocGenerator() {}

	DocGenerator.prototype = {
		getAnchor: function(context) {
			var name = [];

			if (context.static)
				name.push('static');

			if (context.type)
				name.push(context.type);

			name.push(context.name);

			return name.join('-');
		},
		makePageFileName: function(_context, noExt) {
			var context = _context;
			if (!context)
				return null;

			var path = context.getPath();
			var fileName = keyPathToFileName(path);
			if (noExt !== true)
				fileName = fileName + '.md';
			return fileName;
		},
		writePageHeader: function(stream, context) {
			var anchor = this.getAnchor(context);
			stream.write('## ');
			stream.write('<a name="' + anchor + '"></a>');

			if (context.type === 'class')
				stream.write('Class ');
			else if (context.type === 'namespace')
				stream.write('Namespace ');

			stream.write(context.name);
			stream.write('\n\n');
		},
		writeFunctionArguments: function(stream, context) {
			stream.write('(');
			var args = context.parameters;
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
		writeFunctionHeader: function(stream, context) {
			var anchor = this.getAnchor(context),
					parentBlock = context.parent;

			stream.write('### ');
			stream.write('<a name="' + anchor + '"></a>');

			if (context.static)
				stream.write('static ');
			else if (parentBlock.type === 'class')
				stream.write('member ');

			stream.write('function ');
			stream.write(context.name);
			this.writeFunctionArguments(stream, context);
			stream.write('\n\n');
		},
		getReferenceURL: function(contextPath, onlyLast) {
			var context = this.docData.getContextFromPath(contextPath);
			if (!context) {
				console.warn('Warning: No context found for: ', contextPath);
				return '';
			}

			var page = this.makePageFileName(context, true);
			if (!page)
				return '';

			var name = contextPath,
					anchor = this.getAnchor(context);

			if (onlyLast)
				name = context.name;

			return '<a href="' + page.replace(/\s/g,'+') + '#' + anchor + '">' + name + '</a>';
		},
		formatDescription: function(desc) {
			var self = this;
			return desc.trim().replace(/@@@(\S+)@@@/g, function(match, p) {
				return self.getReferenceURL(p);
			});
		},
		writeFunction: function(stream, context) {
			var args = context.parameters;

			if (args && args.length > 0) {
				var finalArgs = args;

				stream.write('> #### Parameter');
				if (args.length > 1)
					stream.write('s');

				for (var i = 0, il = finalArgs.length; i < il; i++) {
					var arg = finalArgs[i];					

					stream.write('\n> * **');
					stream.write(arg.name);
					stream.write('** ');
					if (arg.optional)
						stream.write('<i>[optional]</i>');

					var types = arg.types;
					if (types && types.length > 0) {
						for (var j = 0, jl = types.length; j < jl; j++) {
							var type = types[j];

							stream.write('\n>   * (<i>');
							stream.write(type.name);
							stream.write('</i>) ');
							stream.write(this.formatDescription(type.desc));
						}
					} else if (arg.desc) {
						stream.write(this.formatDescription(arg.desc).replace(/^/gm, '>   * '));
					}
				}

				stream.write('\n>\n');
			}

			var r = context['returns'];
			if (r) {
				var types = r.types;
				stream.write('> #### Return value');
				if (types.length > 1)
					stream.write('s');
				stream.write('\n');

				for (var i = 0, il = types.length; i < il; i++) {
					var type = types[i];
					stream.write('> * (<i>');
					stream.write(type.name);
					stream.write('</i>) ');
					stream.write(this.formatDescription(type.desc).replace(/^\s*/gm, '>   '));	
				}
			} else {
				stream.write('\n> #### Return value is undefined');
			}

			stream.write('\n>\n');
			
			stream.write('> #### Description\n');
			stream.write(this.formatDescription(context.desc).replace(/^\s*/gm, '> '));
			stream.write('\n>\n');

			var notes = context.notes;
			if (notes && notes.length > 0) {
				stream.write('> #### Notes\n');
				for (var i = 0, il = notes.length; i < il; i++) {
					var note = notes[i];
					stream.write('\n> * ');
					stream.write(note);
				}

				stream.write('\n>\n');
			}

			var seeAlso = context.see;
			if (seeAlso && seeAlso.length > 0) {
				stream.write('> #### See Also');
				for (var i = 0, il = seeAlso.length; i < il; i++) {
					var see = seeAlso[i];
					stream.write('\n> * ');
					stream.write(this.getReferenceURL(see.fullPath));
				}

				stream.write('\n>\n');
			}

			var examples = context.examples;
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
		generatePage: function(fileName, context) {
			var self = this;

			return new D.Deferred(function(resolve, reject) {
				try {
					var stream = fs.createWriteStream(fileName);
					stream.setDefaultEncoding('utf8');
					
					self.writePageHeader(stream, context);

					context.traverse(function(context, depth) {
						if (depth > 1)
							return;

						if (context.type !== 'function')
							return;

						console.log('Would write:', context.name);
						self.writeBlock(stream, context);
					});

					stream.end();	
				} catch(e) {
					console.error(e);
					reject(e);
				}
			});
		},
		generatePages: function(docData) {
			if (!docData)
				return;

			var self = this,
					deferreds = [];

			docData.traverse(function(context) {
				if (context.type !== 'class')
					return;

				var pageName = self.makePageFileName(context),
						fullPath = path.join(self.path, pageName);

				console.log('Generating page:', fullPath);
				deferreds.push(self.generatePage(fullPath, context));
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
		generateFooter: function(docData) {

		},
		generate: function(outputPath, docData) {
			if (!docData)
				return D.Deferred.reject('No document data object provided');

			this.path = outputPath;
			this.docData = docData.data;

			var deferreds = [];
			deferreds.push(this.generatePages(docData.data));
			//deferreds.push(this.generateSideBar(docData));
			//deferreds.push(this.generateFooter(docData));

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