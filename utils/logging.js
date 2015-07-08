module.exports = {
    log: function() {
        var d = new Date();
        var args = [
            d.toLocaleDateString(),
            d.toLocaleTimeString() + '.' + d.getMilliseconds() + ':'
        ].concat(Array.prototype.slice.call(arguments, 0));
        console.log.apply(console, args);
    },

    debug: function() {
        var args = Array.prototype.slice.call(arguments, 0);
        console.log.apply(console, args);
    },
};
