(function(factory) {
	module.exports = function() {
		var D = require('devoir');
		return factory({}, D);
	};
})(function(root, D) {
	require('./lib/parse')(root, D);
	return root;
});