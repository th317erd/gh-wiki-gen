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
						this.inherit('name', 'desc');

						if (type)
							this.run('name', type);

						if (desc)
							this.run('desc', desc);

						if (this.hasCommand(type.toLowerCase()))
							this.invoke(type.toLowerCase());
					}));
				}

				this.command('namespace', function(name) {
					return this.appendTo('properties', this.newContext(function() {
						this.inherit('name', 'desc', 'namespace', 'class', 'function', 'property', 'alias', 'see');

						if (name)
							this.run('name', name);
					}));
				});

				this.command('class', function(name) {
					return this.appendTo('properties', this.newContext(function() {
						this.inherit('name', 'class', 'desc', 'example', 'function', 'alias', 'see');

						this.command('constructor', function() {
							var context = this.invoke('function', 'constructor');
							context.type = 'constructor';
							return context;
						});

						if (name)
							this.run('name', name);
					}));
				});

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
					} else if (arguments.length === 1) {
						name = type;
					}

					return this.appendTo('parameters', this.getContext('parameters', function(context) {
						if (context.type === 'parameter' && context.name === name)
							return true;
					}, function() {
						this.inherit('name', 'desc');

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
							});

							this.run('name', name);
						}

						var context = this;
						if (type)
							context = this.run('type', type);

						if (desc)
							context.run('desc', desc);
					}));
				});
				this.alias('parameter', 'param');

				this.command('return', function() {
					return this.set('returns', this.newContext(function(type, desc) {
						this.inherit('desc');

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

				this.command('function', function(name) {
					function contextFunc() {
						this.inherit('name', 'parameter', 'param', 'return', 'returns', 'desc', 'example', 'see');

						if (name)
							this.run('name', name);
					}

					if (this.hasOwnProperty('type') && (this.name).toLowerCase() === 'function')
						return contextFunc.apply(this, arguments);

					return this.appendTo('functions', this.newContext(contextFunc));
				});

				this.command('object', function(name) {
					function contextFunc() {
						this.inherit('name', 'desc', 'property', 'see');

						if (name)
							this.run('name', name);
					}

					if (this.hasOwnProperty('type') && (this.name).toLowerCase() === 'object')
						return contextFunc.apply(this, arguments);

					return this.appendTo('properties', this.newContext(contextFunc));
				});

				this.command('property', function(name, desc) {
					return this.appendTo('properties', this.getContext('properties', function(context) {
						if (context.type === 'property' && context.name === name)
							return true;
					}, function() {
						this.inherit('name', 'desc');

						this.command('type', typeCommand);

						this.command('default', function(value) {
							this.default = value;
						});

						if (name)
							this.run('name', name);

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
