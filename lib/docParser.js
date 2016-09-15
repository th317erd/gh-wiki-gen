(function(factory) {
	module.exports = factory({}, require('devoir'));
})(function(root, D) {
	function trimDots(str) {
		if (!str)
			return str;

		return str.replace(/^\.+/,'').replace(/\.+$/,'');
	}

	function getLine(source, offset) {
    return source.substring(0, offset).split(/\n/).length;
  }

  function joinKeys() {
		var parts = [];
		for (var i = 0, il = arguments.length; i < il; i++) {
			var arg = arguments[i];
			if (!arg)
				continue;

			parts.push(trimDots(arg));
		}

		return parts.join('.');
	}

	function DocParserCommand(name, argumentCount, callback) {
		this.name = name;
		this.argumentCount = argumentCount;
		this.callback = callback;
		this.args = [];
		this.desc = '';
	}

	function DocParser() {
		this.newCommand('base', 0, function(base) {
			this.setContext('base', base);
		});

		this.newCommand('parent', 0, function(parent) {
			this.set('parent', parent);
		});

		this.newCommand('method', 0, function(name) {
			this.set('name', name);
			this.set('type', 'method');
		});

		this.newCommand('class', 0, function(name) {
			this.set('name', name);
			this.set('type', 'class');
		});

		this.newCommand('namespace', 0, function(name) {
			this.set('name', name);
			this.set('type', 'namespace');
		});

    this.newCommand('static', 0, function(desc) {
      this.set('static', true);
    });

    this.newCommand('public', 0, function(desc) {
      this.set('access', 'public');
    });

    this.newCommand('protected', 0, function(desc) {
      this.set('access', 'protected');
    });

    this.newCommand('private', 0, function(desc) {
      this.set('access', 'private');
    });

		this.newCommand('see', 0, function(references) {
			if (!references)
				return;

			this.appendTo('see', references.trim().split(/\s+/g));
		});

    this.newCommand('note', 0, function(note) {
      console.log('Note: ', note.trim().replace(/\n/g, ' '));
      this.appendTo('notes', note.trim().replace(/\n/g, ' '));
    });

		this.newCommand('return', 1, function(types, desc) {
			this.set('return', {
				dataTypes: (types) ? types.trim().split(/\s*\|\s*/g) : [],
				desc: desc
			});
		});

		this.newCommand('param', 2, function(types, _argName, desc) {
      var argName = _argName,
          optional = false,
          defaultValue;

      if (argName.charAt(0) === '[') {
        optional = true;
        argName = argName.replace(/^\[/,'').replace(/\]$/,'');
      }

      var p = argName.match(/^(\w+)(?:\s*=\s*(.*))?$/);
      if (p) {
        if (p[1]) argName = p[1];
        if (p[2]) defaultValue = p[2];
      }

			this.appendTo('arguments', {
				dataTypes: (types) ? types.trim().split(/\s*\|\s*/g) : [],
				name: argName,
				desc: desc,
        optional: optional,
        defaultValue: defaultValue
			})
		});

		this.newCommand('example', 1, function(type, desc) {
			this.appendTo('examples', {
        type: type,
        desc: desc
      });
		});

		this.newCommand('desc', 0, function(desc) {
			this.set('desc', desc)
		});
	}

	DocParserCommand.prototype = {
		appendTo: function(name, value) {
			var val = D.prop(this.output, 'get', name);
			
			if (!(val instanceof Array)) {
				if (val)
					val = [val];
				else
					val = [];
			}

			val = val.concat(value);
			D.prop(this.output, 'set', name, val);

			return this;
		},
		get: function(name) {
			return D.prop(this.output, 'get'. name);
		},
		set: function(name, value) {
      this.output.block = true;
			D.prop(this.output, 'set', name, value);
			return this;
		},
		getContext: function(name) {
			return D.prop(this.context, 'get'. name);
		},
		setContext: function(name, value) {
			D.prop(this.context, 'set', name, value);
			return this;
		}
	};

	DocParser.prototype = {
		getDebugInfo: function(offset) {
			var line = this.line + getLine(this.block, offset);
			return '[' + this.fileName + ']:[' + (line - 1) + ']:';
		},
		newCommand: function(name, argumentCount, callback) {
			if (!this.hasOwnProperty('_commands'))
				D.setROProperty(this, '_commands', {});

			var cmd = new DocParserCommand(name, argumentCount, callback);
			cmd.order = Object.keys(this._commands).length;
			this._commands[name] = cmd;

			return this;
		},
		blockPattern: function(fileName) {
			return /\/\*\*([\s\S]*?)\*\//g;
		},
		blockMatch: function(rawValue, val) {
			return {
				value: val,
				rawValue: rawValue
			};
		},
		parseCommand: function(name, tokens) {
			var argsFinished = false,
					argCount = 0,
					args = [],
					parts = [];

      if (name === 'note')
        console.log('Note command!');

			var commandRunner = this._commands[name];
			if (commandRunner)
				argCount = commandRunner.argumentCount;

			for (var i = 0, il = tokens.length; i < il; i++) {
      	var token = tokens[i];
      	
      	if (!argsFinished) {
      		if (token.type === 'WhiteSpace')
      			continue;

      		if (args.length >= argCount) {
      			argsFinished = true;
      		} else if (token.type !== 'CommandArgument') {
      			console.warn('Warning: ', this.getDebugInfo(token.offset), name + ":", "Command argument list ended unexpectedly");
      			argsFinished = true;
      		} else {
      			args.push(token.value);
      			continue;
      		}
      	}

        if (name === 'note')
          console.log('Token: ', token);

      	if (token.type === 'NewLine')
      		parts.push(' ');
      	else if (token.type === 'Reference')
      		parts.push('@@@' + token.value + '@@@');
      	else
      		parts.push(token.value);
      }

      return {
      	desc: parts.join('').trim(),
      	args: args
      };
		},
		parseBlockTokens: function(outputContext, tokens) {
			var command = "desc",
					commandToken = null,
					commands = {},
      		parts = [],
      		currentTokens = [],
      		output = {
            block: true,
            access: 'public',
            type: 'namespace'
          },
      		self = this;

      for (var i = 0, il = tokens.length; i < il; i++) {
      	var token = tokens[i];

      	if (token.type === 'Command') {
      		if (self._commands[command]) {
      			if (!commands[command])
	      			commands[command] = [];

	      		commands[command].push(this.parseCommand(command, currentTokens));
      		}

      		command = token.value;
      		commandToken = token;
      		currentTokens = [];

      		if (!self._commands[command])
      			console.warn("Warning: ", this.getDebugInfo(token.offset), "Unknown command:", command);

      		continue;
      	}

      	currentTokens.push(token);
      }

      if (currentTokens.length > 0) {
      	if (!self._commands[command]) {
    			console.warn("Warning: ", this.getDebugInfo((commandToken) ? commandToken.offset : 0), "Unknown command:", command);
    		} else {
    			if (!commands[command])
	    			commands[command] = [];

	    		commands[command].push(this.parseCommand(command, currentTokens));	
    		}
      }

      var keys = Object.keys(commands);
      keys = keys.sort(function(a, b) {
      	var cx = self._commands[a],
      			cy = self._commands[b],
      			x = (cx) ? cx.order : 999,
      			y = (cy) ? cy.order : 999;

      	return (x == y) ? 0 : (x < y) ? -1 : 1;
      });

      for (var i = 0, il = keys.length; i < il; i++) {
      	var key = keys[i],
      			cmds = commands[key],
      			runner = self._commands[key];

      	if (!runner)
      		continue;
      	
      	runner.output = output;
      	runner.context = outputContext;
      	runner.parser = self;

      	for (var j = 0, jl = cmds.length; j < jl; j++) {
      		var cmd = cmds[j],
      				args = cmd.args.slice();
      		args.push(cmd.desc);

      		runner.callback.apply(runner, args);
      	}
      }

      var fullPath = joinKeys(D.prop(outputContext, 'get', 'base'), output.parent, output.name);
      if (fullPath) {
      	D.prop(this.output, 'set', fullPath, output);
        D.prop(this.output, 'set', fullPath + '.path', fullPath);
      }
		},
		parseBlock: function(block) {
			var tokenizer = new D.utils.Tokenizer({
        skipWS: false,
        tokenTypes: {
          'NewLine': {
            order: 0,
            pattern: /\n(\s*?\*)?/g
          },
          'String': {
            order: 20,
            pattern: null
          },
          'Example': {
          	order: 5,
            pattern: function(input, offset) {
              var isMatch = this.matchTokens(this.getPrevious(2, ['WhiteSpace', 'NewLine']), [
                {
                  type: 'Command',
                  value: 'example'
                },
                {
                  type: 'CommandArgument',
                }
              ]);

            	if (!isMatch)
            		return;

            	var tokenizer = new D.utils.Tokenizer({
            		skipWS: false,
            		tokenTypes: {
	    						'TagEnd': {
	    							order: 1,
	    							pattern: /(?:[^\\])@/g,
	    							success: function() {
	    								return this.abort();
	    							}
	    						}
	    					}
            	});

            	tokenizer.parse(input, offset);
            	return [tokenizer.getTokensRaw()];
            },
            success: function(value) {
            	function replaceTabs(value) {
            		return value.replace(/^\s+/gm, function(match) {
            			return match.replace(/\t/g,'  ');
            		});
            	}

            	function minimumLineWhitespace(value) {
            		var min = 9999;
            		
            		value.trim().replace(/^\s+\S/gm, function(match) {
            			if (match.length < min)
            				min = match.length;
            			return match;
            		});

            		return min;
            	}

            	function trimPreWhitespace(value) {
            		var min = minimumLineWhitespace(value);
            		return value.replace(/^\s+/gm, function(match) {
            			return match.substring(min);
            		});
            	}

            	var example = trimPreWhitespace(replaceTabs(value));
              console.log('Example: ', example);
            	return example;
            }
          },
          'Reference': {
          	order: 13,
            pattern: function(input, offset) {
            	if (input.offset > 0 && input.charAt(offset - 1) === '\\')
            		return;

            	if (input.charAt(offset) !== '@' && input.charAt(offset + 1) !== '@')
            		return;

            	var re = /@@([\S]+)/g;

							re.lastIndex = offset;
							var match = re.exec(input);
							if (!match || match.index !== offset)
								return;

							return match;
            },
            success: function(rawValue, reference) {
            	return reference;
            }
          },
          'Command': {
          	order: 15,
            pattern: function(input, offset) {
            	if (input.offset > 0 && input.charAt(offset - 1) === '\\')
            		return;

            	if (input.charAt(offset) !== '@' || input.charAt(offset + 1) === '@')
            		return;

            	var re = /@(\w+)/g;

							re.lastIndex = offset;
							var match = re.exec(input);
							if (!match || match.index !== offset)
								return;

							return match;
            },
            success: function(rawValue, commandName) {
            	return commandName;
            }
          },
          'CommandArgument': {
						order: 15,
            pattern: function(input, offset) {
            	if (input.charAt(offset) !== '{')
            		return;

              var token = this.getPrevious(1, ['WhiteSpace'])[0];
              if (!token || (token.type !== 'Command' && token.type !== 'CommandArgument'))
                return;

            	var re = /\{([^}]+)\}/g;

							re.lastIndex = offset;
							var match = re.exec(input);
							if (!match || match.index !== offset)
								return;

							return match;
            },
            success: function(rawValue, value) {
            	return value;
            }
          }
        }
      });

      this.parseBlockTokens(this.context, tokenizer.parse(block));
		}
	};

	root.DocParser = DocParser;

	return root;
});