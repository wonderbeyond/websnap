module.exports = {
    log: function() {
        var args = [new Date() + ':'].concat(Array.prototype.slice.call(arguments, 0));
        console.log.apply(console, args);
    },

    debug: function() {
        var args = Array.prototype.slice.call(arguments, 0);
        console.log.apply(console, args);
    },
};
