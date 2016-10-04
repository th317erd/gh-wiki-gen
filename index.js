(function(factory) {
	module.exports = function() {
		var D = require('devoir');
		return factory({}, D);
	};
})(function(root, D) {
	require('./lib/runner')(root, D);
	return root;
});