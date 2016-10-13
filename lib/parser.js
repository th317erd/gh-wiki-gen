(function(factory) {
	module.exports = factory(require('devoir'));
})(function(D) {
	function getLine(source, offset) {
    return source.substring(0, offset).split(/\n/g).length;
  }

  function Context() {
    this.type = 'global';
    this.parent = null;

    this.command('end', function() {
      return (!this.parent) ? this : this.parent;
    });

    this.command('see', function() {
      var self = this;
      for (var i = 0, il = arguments.length; i < il; i++) {
        var path = arguments[i];
        if (!path)
          continue;

        (function(path) {
          var simplePath = path.replace(/^\w+:/g, '');
          self.appendTo('see', self.getContext('see', function(context) {
            if (context.type === 'see' && context.path === simplePath)
              return true;
          }, function() {
            this.path = simplePath;
            this.fullPath = path;
          }));
        })(path);
      }
    });

    this.command('name', function(name) {
      if (!name)
        return;

      this.name = name;
    });

    this.command('note', function(note) {
      if (!note)
        return;

      this.appendTo('notes', note);
    });

    this.command('desc', function(_desc) {
      if (!_desc)
        return;

      var self = this,
          desc = _desc.replace(/@@@([^\s@]+)@@@/g, function(m, p1) {
            if (self.hasCommand('see'))
              self.run('see', p1);
            return m;
          });

      this.desc = desc;
    });

    this.command('type', function(type) {
      this.type = type;
    });
  }

  var p = Context.prototype = {};
  D.setROProperty(p, 'constructor', Context);
  D.setROProperty(p, 'hasParentContext', function(name) {
    var context = this;
    
    if (context.type === name)
      return true;

    while(context.parent) {
      context = context.parent;
      if (!context)
        return false;

      if (context.type === name)
        return true;
    }

    return false;
  });
  D.setROProperty(p, 'command', function(name, callback) {
    D.setRWProperty(this, '_' + name, function() {
      var args = new Array(arguments.length);
      for (var i = 0, il = arguments.length; i < il; i++)
        args[i] = arguments[i];

      D.setRWProperty(this, '__command', name);
      D.setRWProperty(this, '__arguments', args);

      var ret = callback.apply(this, arguments);
      return (ret instanceof Context) ? ret : this;
    });
    return this;
  });
  D.setROProperty(p, 'alias', function(name, alias) {
    var func = this['_' + name];
    D.setRWProperty(this, '_' + alias, func);

    if (!func.hasOwnProperty('_aliases'))
      D.setROProperty(func, '_aliases', {});

    func._aliases[name] = alias;
    
    return this;
  });
  D.setROProperty(p, 'inherit', function() {
    for (var i = 0, il = arguments.length; i < il; i++) {
      var name = arguments[i],
          func = this['_' + name],
          aliases = (func) ? func._aliases : null;

      D.setRWProperty(this, '_' + name, func);

      if (aliases && aliases[name])
        D.setRWProperty(this, '_' + aliases[name], func);
    }
    
    return this;
  });
  D.setROProperty(p, 'invoke', function(name) {
    var funcName = '_' + name;

    var cmd = this[funcName];
    if (!cmd) {
      console.warn('Warning: Attempt to run command [' + name + '] but command not found in this context');
      return this;
    }

    var args = [];
    if (arguments.length > 1) {
      args = new Array(arguments.length - 1);
      for (var i = 1, il = arguments.length; i < il; i++)
        args[i - 1] = arguments[i];
    }

    return cmd.apply(this, args);
  });
  D.setROProperty(p, 'run', function(name) {
    function findClosestCommandContext(name, context) {
      var funcName = '_' + name;
      if (!context.hasOwnProperty(funcName)) {
        if (!context.parent)
          return context;

        return findClosestCommandContext(name, context.parent);
      }

      return context;
    }
    
    var context = findClosestCommandContext(name, this);
    return context.invoke.apply(context, arguments);
  });
  D.setROProperty(p, 'hasCommand', function(name) {
    return (('_' + name) in this);
  });
  D.setROProperty(p, 'appendTo', function(_name, _value) {
    var name = _name,
        value = _value;

    if (arguments.length === 1) {
      value = name;
      name = this.__command;
    }

    if (!this.hasOwnProperty(name))
      this[name] = [];

    if (this[name].indexOf(value) > -1)
      return value;

    this[name].push(value);
    return value;
  });
  D.setROProperty(p, 'set', function(_name, _value) {
    var name = _name,
        value = _value;

    if (arguments.length === 1) {
      value = name;
      name = this.__command;
    }

    this[name] = value;
    return value;
  });
  D.setROProperty(p, 'newContext', function(_name, _func) {
    var name = _name,
        func = _func;

    if (name instanceof Function) {
      func = name;
      name = null;
    }

    var context = Object.create(this);
    if (name)
      context.type = name;
    else
      context.type = this.__command;

    context.parent = this;

    //Always inherit the end command
    context.inherit('end');

    if (func instanceof Function)
      func.apply(context, this.__arguments || []);

    return context;
  });
  D.setROProperty(p, 'getContext', function(_name, _searchFunc, _func) {
    var name = _name,
        searchFunc = _searchFunc,
        func = _func;

    if (name instanceof Function) {
      func = searchFunc;
      searchFunc = name;
      name = 'children';
    }

    var children = this[name];
    if (children && children.length > 0) {
      for (var i = 0, il = children.length; i < il; i++) {
        var child = children[i];
        if (searchFunc.call(this, child) === true)
          return child;
      }
    }

    return this.newContext(null, func);
  });
  D.setROProperty(p, 'getRootContext', function() {
    var context = this;
    
    while(context.parent)
      context = context.parent;
    
    return context;
  });
  D.setROProperty(p, 'getContextFromPath', function(path) {
    function find(context, type, names, _nameIndex) {
      var nameIndex = _nameIndex || 0,
          name = names[nameIndex];

      if (nameIndex >= names.length)
        return context;

      if (context.parent instanceof Context) {
        if ((nameIndex + 1) >= names.length) {
          if (type && context.type === type && context.name === name) {
            return context;
          } else if (!type && context.name === name) {
            return context;
          }
        } else if (context.name === name) {
          return find(context, type, names, nameIndex + 1);
        }
      }

      var keys = Object.keys(context);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            val = context[key];

        if (key === 'parent')
          continue;

        if (D.utils.instanceOf(val, 'string', 'boolean', 'number', 'function'))
          continue;

        if (val instanceof Object) {
          var ret = find(val, type, names, nameIndex);
          if (ret)
            return ret;
        }
      }

      return null;
    }

    if (!path)
      return null;

    var rootContext = this.getRootContext(),
        type,
        name = path.replace(/^(\w+):/, function(match, p1) {
          type = p1;
          return '';
        });

    return find(rootContext, type, name.split('.'));
  });
  D.setROProperty(p, 'traverse', function(callback) {
    function walk(context, _depth) {
      var depth = _depth || 0;

      var keys = Object.keys(context);
      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            val = context[key];

        if (key === 'parent')
          continue;

        if (D.utils.instanceOf(val, 'string', 'boolean', 'number', 'function'))
          continue;

        if (val instanceof Object) {
          if (val instanceof Context) {
            if (callback.call(self, val, depth) === false)
              break;
          }

          if (walk(val, depth + 1) === false)
            break;
        }
      }
    }

    if (!(callback instanceof Function))
      return false;

    var self = this;
    return walk(this);
  });
  D.setROProperty(p, 'getPath', function(filter) {
    var parts = [],
        context = this;

    while(context.parent) {
      var keep = (filter instanceof Function) ? filter(context) : true;
      if (keep !== false && context.name)
        parts.push(context.name);
      context = context.parent;
    }

    if (context.name)
      parts.push(context.name);

    var path = parts.reverse().join('.');
    if (this.type) {
      if (path)
        path = this.type + ':' + path;
      else
        path = this.type;
    }

    return path;
  });

	function Parser() {}

	Parser.prototype = {
		getDebugInfo: function(offset) {
			var line = getLine(this.source, offset);
			return '[' + this.fileName + ']:[' + (line - 1) + ']:';
		},
    createRootContext: function() {
      return new Context();
    },
		parseCommandArguments: function(tokens, offset) {
			var args = [],
					parts = [];

			for (var i = offset, il = tokens.length; i < il; i++) {
      	var token = tokens[i];

        if (token.type === 'Command') {
          break;
        } else if (token.type === 'CommandArgument') {
          if (parts.length > 0) {
            var str = parts.join('').trim();
            if (str.length > 0)
              args.push(str);
            parts = [];
          }

          args.push(token.value);
          continue;
        }

      	if (token.type === 'NewLine')
      		parts.push('\n');
      	else if (token.type === 'Reference')
      		parts.push('@@@' + token.value + '@@@');
      	else
      		parts.push(token.value);
      }

      if (parts.length > 0) {
        var str = parts.join('').trim();
        if (str.length > 0)
          args.push(str);
      }

      return {
        offset: i,
        args: args
      };
		},
		parseBlockTokens: function(context, tokenizer, tokens) {
			var self = this,
          currentContext = context;

      for (var i = 0, il = tokens.length; i < il;) {
      	var token = tokens[i];

      	if (token.type === 'Command') {
      		var command = token.value,
              ret = this.parseCommandArguments(tokens, i + 1);
          
          i = ret.offset;

          //If we were asked to end the previous command then do so
          if (token.endPrevious)
            currentContext = currentContext.run.call(currentContext, 'end');

          if (currentContext.hasCommand(command)) {
            currentContext = currentContext.run.bind(currentContext, command).apply(currentContext, ret.args);
          } else {
            console.warn("Warning: ", this.getDebugInfo(token.offset), "Unknown command:", command);
            console.log('Context: ', D.id(currentContext));
          }
      	} else {
          //Skip unknown
          i++;
        }
      }

      return currentContext;
		},
    parse: function(fileName, source) {
      this.source = source;
      this.fileName = fileName;

      var tokenizer = new D.utils.Tokenizer({
        skipWS: false,
        tokenTypes: {
          'Identifier': {
            order: 10,
            pattern: /([a-zA-Z][a-zA-Z0-9_]*)/g
          },
          'Block': {
            order: 25,
            pattern: /\/\*\*([\s\S]*?)\*+\//g,
            success: function(rawValue, val, offset) {
              return {
                line: getLine(source, offset),
                value: val,
                rawValue: rawValue
              };
            }
          },
          'Ignore': {
            order: 26,
            pattern: function(input, offset) {
              var re = /\/\/[^\n]*\n/g;

              re.lastIndex = offset;
              var match = re.exec(input);
              if (match && match.index === offset)
                return this.skip();

              var re = /\/\/\*[\s\S]*?\*\//g;

              re.lastIndex = offset;
              var match = re.exec(input);
              if (match && match.index === offset)
                return this.skip();
            }
          }
        }
      });

      var tokens = tokenizer.parse(source),
          context = this.context,
          globalContext = context;

      if (!this.context)
        context = globalContext = this.context = this.createRootContext();

      for (var i = 0, il = tokens.length; i < il; i++) {
        var token = tokens[i];
        if (token.type === 'Block')
          context = this.parseBlock(context, token.value);
      }

      return globalContext;
    },
		parseBlock: function(context, block) {
			var tokenizer = new D.utils.Tokenizer({
        skipWS: false,
        tokenTypes: {
          'NewLine': {
            order: 0,
            pattern: /\n(\s*?\*)?/g,
            success: function(match, p) {
              var obj = {value: match};
              if (p && p.trim().length > 0)
                obj.starred = true;
              return obj;
            }
          },
          'String': {
            order: 20,
            pattern: null
          },
          'Example': {
          	order: 5,
            pattern: function(input, offset) {
              var isMatch = this.matchTokens(this.get(2, -0, ['WhiteSpace', 'NewLine']), [
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
	    							pattern: function(input, offset) {
                      if (input.charAt(offset) === '@' && input.charAt(offset - 1) !== '\\')
                        return ['@'];
                    },
	    							success: function() {
	    								return this.abort();
	    							}
	    						}
	    					}
            	});

            	tokenizer.parse(input, offset);
            	return [tokenizer.join()];
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
            	return example;
            }
          },
          'Reference': {
          	order: 13,
            pattern: function(input, offset) {
            	if (input.offset > 0 && input.charAt(offset - 1) === '\\')
            		return;

            	if (input.charAt(offset) !== '@' && input.charAt(offset + 1) !== '@' && input.charAt(offset + 2) !== '@')
            		return;

            	var re = /@@@([\S]+)(@@@)?/g;

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

            	if (input.charAt(offset) !== '@')
            		return;

            	var re = /@@?(\w+)/g;

							re.lastIndex = offset;
							var match = re.exec(input);
							if (!match || match.index !== offset)
								return;

							return match;
            },
            success: function(rawValue, commandName) {
              var obj = {value: commandName};
              if (rawValue.charAt(1) === '@')
                obj.endPrevious = true;
            	return obj;
            }
          },
          'CommandArgument': {
						order: 15,
            pattern: function(input, offset) {
            	if (input.charAt(offset) !== '{')
            		return;

              var token = this.get(1, -0, ['WhiteSpace'])[0];
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

      return this.parseBlockTokens(context, tokenizer, tokenizer.parse(block));
		}
	};

  Parser.Context = Context;

	return Parser;
});