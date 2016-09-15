# gh-wiki-gen

Automatically generate GitHub wiki documentation. By default this parser will work for any source code that uses `/* comment */` style comments (Javascript, C, C++, Java) 

# Install
```bash
npm install gh-wiki-gen
```

# Use
Clone your project from GitHub
```bash
# git clone git@github.com:(username)/(repo).git
```

Clone your project's GitHub wiki: 
```bash
# git clone git@github.com:(username)/(repo).wiki.git
```

Create a "docGen.js" file in your project's root directory. This is the configuration file `gh-wiki-gen` will use:
```javascript
//docGen.js
module.exports = function() {
	return {
        //RegExp include / exclude / extensions (extensions are smart)
		include: ['^src/.*'],
        exclude: [],
		extensions: ['js'],
		inputPath: './',
		outputPath: '../(ropo).wiki'
	};
};

```

Run `gh-wiki-gen` (in your project's root directory) to generate your libraries documentation: 
```bash
# cd (repo)
# gh-wiki-gen
```

Commit the new documentation and push upstream to GitHub:
```bash
# cd ../(repo).wiki
# git commit -a -m "Documentation update"
# git pull
# git push
```

# Comment Block Format

Code comments take the following format (the * at the beginning of each line is optional):
```
/**
* Description goes here...
* 
* @command value
* @command {arg1} value
* @command {arg1} {arg2} value
* @example {source type}
  Example code
  goes here
**/
```

Default command list:
* **@base** *base.path* - Specify a base path for the entire file. This is prefixed onto any specified @parent
* **@parent** *parent.path* - Specify parent object / namespace / class / function, using dot notation (i.e root.child.grandchild)
* **@method** *name* - This block is a method definition
* **@class** *name* - This block is a class definition
* **@namespace** *name* - This block is a namespace definition
* **@param** *{Acceptable|Data|Types|Separated|By|Pipe} {argument name} description* - Specify one of this method's arguments. This is only valid for "@method" blocks. Wrapping an argument name in square braces means the argument is optional. You can specify a default value with "=default value" (i.e. {[myArgName="hello world"]}). Repeat this command to add more arguments.
* **@note** *note* - Specify a "note" to add to the "Notes" section of the documentation. Repeat command to add multiple notes
* **@see** *dot.path.reference* - "See Also" references. Repeat command to add more than one "See Also" reference
* **@return** *{Acceptable|Data|Types|Separated|By|Pipe} description* - Specify a return value. Only valid for "@method" blocks.
* **@static** - Specify this block as being static
* **@public** - Specify this block as having public access
* **@protected** - Specify this block as having protected access
* **@private** - Specify this block as having private access
* **@example** *{source type}*

  source code example
  
  goes here 

# Example
```javascript
/**
* Return the minimum of all arguments provided
*
* @method min
* @param {Number} {[args...]} Numerical arguments
* @return {Number} Smallest number out of all provided arguments
* @example {javascript}
  var smallest = min(5,3,10,7,1,80);
  //smallest === 1
**/
 
function min() {
    for (var s, i = 0, il = arguments.length; i < il; i++) {
        var n = arguments[i];
        if (s === undefined || n < s)
            s = n;
    }

    return s;
}
```

# Customize
To see how to make custom document parsers and generators please see the [wiki](https://github.com/th317erd/gh-wiki-gen/wiki/Customize).