(function(factory) {
	module.exports = function(options, parser, D) {
		var constructorFunc = factory(parser, D);
		return new constructorFunc(options);
	};
})(function(parser, D) {
	function DefaultParser() {
		parser.DocParser.call(this);
	}

	DefaultParser.prototype = D.data.extend(Object.create(parser.DocParser.prototype), {
		createGlobalContext: function() {
			function buildContext() {
				function typeCommand(type, desc) {
					return this.appendTo('types', this.getContext('types', function(context) {
						if (context.type === 'type' && context.name === type)
							return true;
					}, function() {
						this.inherit('name', 'desc', 'note');

						this.run('name', type);

						if (desc)
							this.run('desc', desc);

						if (this.hasCommand(type.toLowerCase()))
							this.invoke(type.toLowerCase());
					}));
				}

				function classFieldCommands() {
					this.command('const', function() {
						this.constant = true;
					});

					this.command('static', function() {
						this.static = true;
					});

					this.command('public', function() {
						this.visibility = 'public';
					});

					this.command('protected', function() {
						this.visibility = 'protected';
					});

					this.command('private', function() {
						this.visibility = 'private';
					});

					this.visibility = 'protected';
				}

				this.command('namespace', function(name) {
					return this.appendTo('properties', this.newContext(function() {
						this.inherit('name', 'desc', 'namespace', 'class', 'function', 'property', 'alias', 'see', 'note');

						if (name)
							this.run('name', name);
					}));
				});

				this.command('class', function(name, desc) {
					return this.appendTo('properties', this.newContext(function() {
						this.inherit('name', 'class', 'desc', 'example', 'function', 'alias', 'see', 'note');

						classFieldCommands.call(this);
						if (this.parent && this.parent.type === 'namespace' || this.parent.type === 'global')
							this.visibility = 'public';

						this.command('constructor', function() {
							var context = this.invoke('function', 'constructor');
							context.type = 'constructor';
							return context;
						});

						this.run('name', name);
						this.run('desc', desc);
					}));
				});
				this.alias('class', 'struct');

				this.command('alias', function(path) {
					var type = D.utils.extract(path, /^(\w+):/, 1);

					if (!type) {
						context = this.getContextFromPath(path);
						if (context)
							type = context.type;
					}

					var subKey = 'aliases';
					if (type) {
						if (type === 'function')
							subKey = 'functions';
						else if (type === 'class' || type === 'namespace')
							subKey = 'properties';
					}

					return this.appendTo(subKey, this.newContext(function(path) {
						this.inherit('see');

						if (type)
							this.subType = type;
						this.path = path;
						this.run('see', path);
					}));
    		});

				this.command('parameter', function(_type, _name, _desc) {
					var type = _type,
							name = _name,
							desc = _desc;

					if (arguments.length === 2) {
						desc = name;
						name = type;
						type = null;
					} else if (arguments.length === 1) {
						name = type;
						type = null;
					}

					var context = this.appendTo('parameters', this.getContext('parameters', function(context) {
						if (context.type === 'parameter' && context.name === name)
							return true;
					}, function() {
						this.inherit('name', 'desc', 'note');

						this.command('type', typeCommand);

						this.command('default', function(value) {
							this.default = value;
						});

						this.command('optional', function() {
							this.optional = true;
						});

						this.optional = false;

						if (name) {
							var self = this;
							name = name.trim().replace(/^\[([^\]]+)\]$/, function(m, p1) {
								self.optional = true;
								return p1;
							}).replace(/=(.*)$/g, function(m, p1) {
								self.default = p1;
								return '';
							});;

							this.run('name', name);
						}

						//this.run('desc', desc);
					}));

					if (type)
						context.run('type', type, desc);

					return context;
				});
				this.alias('parameter', 'param');

				this.command('return', function() {
					return this.set('returns', this.newContext(function(type, desc) {
						this.inherit('desc', 'note');

						this.command('type', typeCommand);

						if (type) {
							var context = this.run('type', type);
							
							if (desc)
								context.run('desc', desc);
						}
					}));
				});
				this.alias('return', 'returns');

				this.command('example', function() {
					return this.appendTo('examples', this.newContext(function(type, example) {
						if (arguments.length > 1) {
							this.language = type;
							this.example = example;
						} else {
							this.example = type;
						}
					}));
				});

				this.command('function', function(name, desc) {
					function contextFunc() {
						this.inherit('name', 'parameter', 'return', 'desc', 'example', 'see', 'note');

						classFieldCommands.call(this);

						this.run('name', name);
						this.run('desc', desc);
					}

					if (this.hasOwnProperty('type') && this.type === 'type' && (this.name).toLowerCase() === 'function') {
						this.visibility = 'public';
						return contextFunc.apply(this, arguments);
					}

					return this.appendTo('functions', this.newContext(contextFunc));
				});

				this.command('object', function(name, desc) {
					function contextFunc() {
						this.inherit('name', 'desc', 'property', 'see', 'note');

						classFieldCommands.call(this);
						this.visibility = 'public';

						this.run('name', name);
						this.run('desc', desc);
					}

					if (this.hasOwnProperty('type') && this.type === 'type' && (this.name).toLowerCase() === 'object') {
						this.visibility = 'public';
						return contextFunc.apply(this, arguments);
					}

					return this.appendTo('properties', this.newContext(contextFunc));
				});

				this.command('property', function(_name, desc) {
					var name = _name;
					return this.appendTo('properties', this.getContext('properties', function(context) {
						if (context.type === 'property' && context.name === name)
							return true;
					}, function() {
						this.inherit('name', 'desc', 'note');

						classFieldCommands.call(this);
						if (this.parent && this.parent.type === 'type' || this.parent.type === 'object')
							this.visibility = 'public';

						this.command('type', typeCommand);

						this.command('default', function(value) {
							this.default = value;
						});

						if (name) {
							var self = this;
							name = name.replace(/=(.*)$/g, function(m, p1) {
								self.default = p1;
								return '';
							});

							this.run('name', name);
						}

						if (desc)
							this.run('desc', desc);
					}));
				});

				return this;
			}

			var context = new parser.Context();
			return buildContext.call(context);
		}
	});

	return DefaultParser;
});
