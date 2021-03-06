(function(factory) {
	module.exports = function(options, base, D) {
		var constructorFunc = factory(base, D);
		return new constructorFunc(options);
	};
})(function(base, D) {
	function MarkdownGenerator() {
		base.call(this);
	}

	MarkdownGenerator.prototype = D.data.extend(Object.create(base.prototype), {
		createRootBlock: function() {
			function buildBlock() {
				function addItemToSidebar(context) {
					var contextPath = context.getPath(function(context) {
						if (context.type !== 'namespace' &&
								context.type !== 'class' &&
								context.type !== 'function' &&
								context.type !== 'constructor')
							return false;
					}).replace(/^[^:]+:/,'');


					var name = D.utils.extract(contextPath, /([^.]+)$/, 1),
							val = D.get(sidebarItems, contextPath);

					if (val === undefined)
						D.set(sidebarItems, contextPath, name);
				}

				var sidebarItems = {};
				this.defaultPageExt = 'md';

				this.command('anchor', function(context, name) {
					var a = this.anchor(),
							currentPage = this.currentPage(),
							pageName = (currentPage) ? 1 : undefined;

					this.write('<a href="');
					if (pageName instanceof String || typeof pageName === 'string')
						this.write(pageName);
					//this.write('.' + this.defaultPageExt);
					this.write('#' + a.hash);
					this.write('">');

					if (name)
						this.write(name);

					this.write('</a>');
				});

				this.command('header', function(context, name, _depth, _type) {
					var depth = (_depth) ? _depth : this.depth();
					this.write(new Array(depth + 1).join('#'));
					this.write(' ');
					this.run('anchor');
					if (context.static)
						this.write('static ');
					
					if (_type) {
						this.write(_type);
					} else {
						if (context.type === 'function' && context.parent.type === 'class')
							this.write('method');
						else
							this.write(context.type.toLowerCase());
					}
					
					this.write(' ' + name);
				});

				this.command('desc', function(context, desc) {
					if (!desc)
						return;

					var self = this;
					this.write(desc.trim().replace(/@@@(\S+)@@@/g, function(match, p) {
		        return self.referenceURL(p);
		      }));
				});

				this.command('property', function(context, prop) {
					this.write('**');
          this.write(context.name);

          if (context.default) {
          	this.write('** (<i>');
	          this.write(context.default);
	          this.write('</i>)');
          }
          
          this.write(': ');
          this.run('desc', context.desc);
				});

				this.command('object', function(context) {
					function writeProperties(context) {
			    	var props = context.properties;
			    	if (context.hasOwnProperty('properties') && props && props.length > 0) {
			        for (var i = 0, il = props.length; i < il; i++) {
			          var prop = props[i];          

			          this.write('\n * ');
			          this.write(this.newBlock(prop, function() {
			          	this.run('property');
			          }));
			        }
			      }

			      this.write('\n\n');
			    }

					if (context.type === 'type' && context.parent.type === 'parameter') {
						var type = '(Object) parameter';
						this.run('header', context.parent.name, 3, type);						
					} else {
						this.run('header', context.name, 3);
					}

					this.write('\n');

					writeProperties.call(this, context);
				});

				this.command('function', function(context) {
					function writeArguments(context) {
			      this.write('(');
			      var args = context.parameters;
			      if (context.hasOwnProperty('parameters') && args && args.length > 0) {
			        var argCount = 0, optionalArgCount = 0;
			        for (var i = 0, il = args.length; i < il; i++) {
			          var arg = args[i];          
			          if (arg.optional) {
			            optionalArgCount++;
			            continue;
			          }

			          if (argCount > 0)
			            this.write(', ');

			          argCount++;
			          this.write(arg.name);
			        }

			        for (var i = 0, il = args.length; i < il; i++) {
			          var arg = args[i];          
			          if (!arg.optional)
			            continue;

			          this.write('[');
			          if (argCount > 0)
			            this.write(', ');

			          argCount++;
			          this.write('<i>' + arg.name + '</i>');  
			        }

			        if (optionalArgCount > 0)
			          this.write(new Array(optionalArgCount + 1).join(']'));
			      }
			      this.write(')');
			    }

			    function writeParameters(context) {
			    	var args = context.parameters;
			    	if (context.hasOwnProperty('parameters') && args && args.length > 0) {
			        this.write('#### Parameters');

			        for (var i = 0, il = args.length; i < il; i++) {
			          var arg = args[i],
			          		paramContext = arg;          

			          this.write('\n * **');
			          this.write(arg.name);
			          this.write('** ');
			          if (arg.optional)
			            this.write('<i>[optional]</i>');

			          var types = arg.types;
			          if (types && types.length > 0) {
			            for (var j = 0, jl = types.length; j < jl; j++) {
			              var type = types[j];

			              this.write('\n   * (<i>');
			              this.write(type.name);
			              this.write('</i>) ');

			              if (type.name.match(/(function|object)/i)) {
			              	var pageName = this.pageName(type);
			              	this.newPage(pageName, function(context) {
			              		if (type.name.match(/^function$/i))
			              			paramContext.run('function');
			              		else
			              			paramContext.run('object');
			              	}, type);

			              	var a = this.anchor(type);
			              	this.write('<a href="' + pageName + '#' + a.hash + '">&gt;&gt;&gt;</a> ');
			              }

			              paramContext.run('desc', type.desc);
			            }
			          } else if (arg.desc) {
			          	this.write('    * ');
			          	paramContext.run('desc', arg.desc);
			          }
			        }
			      } else {
			      	this.write('#### Parameters');
			      	this.write('\n * None');
			      }

			      this.write('\n\n');
			    }

			    function writeReturns(context) {
			    	var r = context['returns'];
			      if (context.hasOwnProperty('returns') && r) {
			        var types = r.types;
			        this.write('#### Return value');
			        if (types.length > 1)
			          this.write('s');

			        for (var i = 0, il = types.length; i < il; i++) {
			          var type = types[i],
			          		typeContext = type;

			          this.write('\n* (<i>');
			          this.write(type.name);
			          this.write('</i>) ');
			          typeContext.run('desc', type.desc);  
			        }
			      } else {
			        this.write('#### Return value');
			        this.write('\n * None');
			      }

			      this.write('\n\n');
			    }

			    function writeDescription(context) {
			    	this.write('#### Description\n');
			      this.run('desc', context.desc);
			      this.write('\n\n');
			    }

			    function writeNotes(context) {
			    	var notes = context.notes;
			      if (context.hasOwnProperty('notes') && notes && notes.length > 0) {
			        this.write('> #### Notes');
			        for (var i = 0, il = notes.length; i < il; i++) {
			          var note = notes[i];
			          this.write('\n * ');
			          this.write(note);
			        }

			        this.write('\n\n');
			      }
			    }

			    function writeSeeAlso(context) {
			    	var seeAlso = context.see;
			      if (context.hasOwnProperty('see') && seeAlso && seeAlso.length > 0) {
			        this.write('#### See Also');
			        for (var i = 0, il = seeAlso.length; i < il; i++) {
			          var see = seeAlso[i];
			          this.write('\n * ');
			          this.write(this.referenceURL(see.fullPath, see.path));
			        }

			        this.write('\n\n');
			      }
			    }

			    function writeExamples(context) {
			    	var examples = context.examples;
			      if (context.hasOwnProperty('examples') && examples && examples.length > 0) {
			        this.write('#### Examples');
			        for (var i = 0, il = examples.length; i < il; i++) {
			          var example = examples[i];
			          this.write('\n ```');

			          if (example.language) {
			          	this.write(example.language);
			          	this.write('\n');	
			          }
			          
			          this.write(example.example.trim());
			          this.write('\n ```');
			        }

			        this.write('\n\n');
			      }
			    }

					this.postProcess = function(str) {
						return str.replace(/\n/gm, '\n> ');
					};

					addItemToSidebar(context);

					if (context.type === 'type' && context.parent.type === 'parameter') {
						var type = '(Function) parameter';
						this.run('header', context.parent.name, 3, type);						
					} else {
						this.run('header', context.name, 3);
					}

					writeArguments.call(this, context);
					this.write('\n');
					
					writeParameters.call(this, context);
					writeReturns.call(this, context);
					writeDescription.call(this, context);
					writeNotes.call(this, context);
					writeSeeAlso.call(this, context);
					writeExamples.call(this, context);
				});

				this.command('alias', function(aliasContext) {
					var context = this.getContextFromPath(aliasContext.path);
					if (!context)
						return;

					if (context.static)
						this.write('static ');

					var type = context.type;
					if (type === 'function' && context.parent.type === 'class')
						type = 'method';

					this.run('header', aliasContext.name, 3, type);
					this.write('()\n');
					this.write('> * Alias of ' + type + ' ');
					this.write(this.referenceURL(aliasContext.path, context.name));
				});

				this.command('class', function(context) {
					this.newPage(function(context) {
						this.run('header', context.name, 2);
						this.write('\n');

						this.each('functions', function(context) {
							if (context.type === 'function' || context.type === 'constructor') {
								this.run('function', false);
							} else if (context.type === 'alias') {
								this.run('alias');
							}

							this.write('\n---\n');
						}, function(a, b) {
							var x = a.name,
									y = b.name;

							if (x === 'constructor')
								x = '0' + x;
							else if (a.static)
								x = '2' + x;
							else
								x = '1' + x;

							if (y === 'constructor')
								y = '0' + y;
							else if (b.static)
								y = '2' + y;
							else
								y = '1' + y;

							return (x == y) ? 0 : (x < y) ? -1 : 1;
						});
					});
				});

				this.command('namespace', function(context) {
					this.newPage(function(context) {
						this.run('header', context.name, 2);
						this.write('\n');

						this.postProcess = function(str) {
							return str.trim().replace(/\n/gm, '\n* ');
						};

						this.each('properties', function(context) {
							this.write('(<i>' + context.type + '</i>) ');
							
							if (context.type === 'namespace') {
								var page = this.pageName(context);
								this.write('<a href="' + page + '">' + context.name + '</a>');
							} else {
								this.run('anchor', context.name);	
							}
							
							this.run(context.type);
							this.write('\n');
						});

						this.each('functions', function(context) {
							var page = this.pageName(context);
							this.write('(<i>' + context.type + '</i>) ');
							this.write('<a href="' + page + '">' + context.name + '</a>');
							this.write('\n');
						});

						this.each('functions', function(context) {
							this.newPage(function(context) {
								if (context.type === 'function' || context.type === 'constructor') {
									this.run('function', false);
								} else if (context.type === 'alias') {
									this.run('alias');
								}

								this.write('\n---\n');
							});
						}, function(a, b) {
							var x = a.name,
									y = b.name;

							return (x == y) ? 0 : (x < y) ? -1 : 1;
						});
					});
				});

				this.command('global', function(context) {
					this.newPage('_Sidebar.md', function() {
						this.toString = function() {
							function dumpLinks(obj, _parents) {
								function writeLink(type, name, parents) {
									var listing = parents.concat(name),
											fullName = listing.join('_').replace(/[\W_]/g,'_'),
											link = type + '_' + fullName;

									parts.push(new Array(parents.length * 2 + 1).join(' '));
									parts.push('* [');
									parts.push(key);
									parts.push('](');
									parts.push(link);
									parts.push(' "');
									parts.push(key);
									parts.push('")\n');
								}

								var keys = Object.keys(obj),
										parents = _parents || [];

								if (keys.length === 0)
									return;

								for (var i = 0, il = keys.length; i < il; i++) {
									var key = keys[i],
											value = obj[key];

									if (value instanceof String || typeof value === 'string') {
										writeLink('Function', key, parents);
									} else if (value instanceof Object) {
										writeLink('Namespace', key, parents);
										dumpLinks(value, parents.concat(key));
									}
								}
							}

							var parts = [];
							dumpLinks(sidebarItems);
							return parts.join('');
						};
					}, {});

					this.newPage(function() {
						this.each('properties', function(context) {
							this.run('anchor');
						});
					});

					this.each('properties', function(context) {
						this.run(context.type);
					});
				});

				return this;
			}

			return buildBlock.call(new base.Block());
		}
	});

	return MarkdownGenerator;
});