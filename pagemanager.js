/**
 * Manage pages like real web browser, with multiple windows.
 * Support multiple phantomjs instances and multiple pages per instance.
 */

var logging = require('./utils/logging.js');
var phantom = require('phantom');
var util = require('util');
var _ = require("lodash");

/**
 * Page manager factory
 * manager manages working pages and recycled pages
 * TODO: support multiple phantomjs instances
 */
module.exports.create = function(options) {
    options = options || {};

    return {
        excludes: options.excludes || [], // regex patterns to exclude resources
        maxPhantomjsInstances: 10,
        maxPages: 100, // not implemented yet

        shouldExclued: function(url) {
            for (var i = 0, len = this.excludes.length; i < len; i++) {
                if(this.excludes[i].test(url)) {
                    return true;
                }
            }
            return false;
        },

        phantomjsInstances: [],
        // Pages in workingPages and recycledPages may belong to different phantomjsInstances,
        // and each page has a `belongingPhantomjs` attr.
        workingPages: [],
        recycledPages: [],

        _setupPage: function(page) {
            var thisManager = this;

            // Refer to:
            // - https://gist.github.com/cjoudrey/1341747, about trace of pending requests
            // - https://cdnjs.com/libraries/backbone.js/tutorials/seo-for-single-page-apps/
            page.pendingRequests = 0;
            page.waitMoreRequestsAfter0Timeout = undefined;
            page._pageIdleListeners = [];

            page.onIdle = function(callback) {
                page._pageIdleListeners.push(callback);
            };

            page.setIdle = function() {
                page._pageIdleListeners.splice(0).forEach(function(callback) {
                    callback();
                });
            };

            // handle total timeout of page
            page.waitMoreRequests = function() {
                return setTimeout(function() {
                    logging.log("It's 5s with no new requests after last request sent");
                    page.setIdle();
                }, 10000);
            };
            page.waitMoreRequestsTimeout = page.waitMoreRequests();

            page.set('settings.excludedResources', thisManager.excludes.map(function(v) {
                return v.toString();
            }));

            page.set('settings.userAgent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.130 Safari/537.36');
            page.set('onUrlChanged', function(targetUrl) {
                logging.log('New URL: ' + targetUrl);
            });

            page.set('onClosing', function(closingPage) {
                logging.log('Closing page, URL: ', closingPage.url);
                page.pendingRequests = 0;
            });

            page.onResourceRequested(function(requestData, request) {
                // NOTE: this code executes in the scope of phantomjs
                console.log('Request#' + requestData.id, requestData.url);

                page.settings.excludedResources.forEach(function(v) {
                    var pat = eval(v);
                    if (pat.test(requestData.url)) {
                        request.abort();
                        console.log(requestData.url, 'rejected');
                    }
                });
            }, function(requestData) {
                // NOTE: this code executes just here
                if (!thisManager.shouldExclued(requestData.url)) {
                    if (page.waitMoreRequestsAfter0Timeout) {
                        logging.log('New requests comes after pending count went 0');
                        clearTimeout(page.waitMoreRequestsAfter0Timeout);
                        page.waitMoreRequestsAfter0Timeout = undefined;
                    }
                    page.pendingRequests += 1;
                    logging.log(util.format('Pending requests=%d, plus %s', page.pendingRequests, requestData.url));

                    if(page.waitMoreRequestsTimeout) {
                        clearTimeout(page.waitMoreRequestsTimeout);
                    }
                    page.waitMoreRequestsTimeout = page.waitMoreRequests();

                }
            });

            page.set('onResourceReceived', function(response) {
                logging.log('Response#' + response.id, response.stage, response.url);
                if (response.stage === 'end' && response.url && !thisManager.shouldExclued(response.url)) {
                    page.pendingRequests -= 1;
                    logging.log(util.format('Pending requests=%d, minus %s', page.pendingRequests, response.url));
                    if (page.pendingRequests === 0) {
                        logging.log('Wait if more requests...');
                        page.waitMoreRequestsAfter0Timeout = setTimeout(function() {
                            logging.log('No more requests 100ms after pending request went 0');
                            page.setIdle();
                        }, 100);
                    }
                }
            });

            return page;
        },


        /**
         * Get load state of all phantomjs instances
         */
        loadState: function() {
            var thisManager = this;
            var res = {};
            thisManager.phantomjsInstances.forEach(function(ph) {
                res[ph.process.pid] = {
                    workingPages: 0,
                    recycledPages: 0
                };
            });

            thisManager.workingPages.forEach(function(p) {
                res[p.belongingPhantomjs.process.pid].workingPages += 1;
            });
            thisManager.recycledPages.forEach(function(p) {
                res[p.belongingPhantomjs.process.pid].recycledPages += 1;
            });

            return res;
        },

        /**
         * Tell internal state
         */
        tellState: function() {
            var thisManager = this;
            logging.log(util.format('Page manager has %d phantomjs instances, ' +
                '%d working pages, %d recycled pages',
                thisManager.phantomjsInstances.length,
                thisManager.workingPages.length,
                thisManager.recycledPages.length
            ));
            logging.log('Detailed load balance:', JSON.stringify(thisManager.loadState()));
        },

        /**
         * Create a phantomjs instance
         * TODO: do not create if instances exceeds the limit
         */
        getPhantomInstance: function(callback) {
            var thisManager = this;
            var curCount = thisManager.phantomjsInstances.length;
            if (curCount < thisManager.maxPhantomjsInstances /* and all instances are fully-loaded */) {
                if (!thisManager._createingPhantomjsInstance) {
                    logging.log('Creating new phantomjs instance');
                    thisManager._createingPhantomjsInstance = true;
                    phantom.create(function(ph) {
                        thisManager.phantomjsInstances.push(ph);
                        logging.log(util.format('New phantomjs instance(pid=%s) created', ph.process.pid));
                        callback(ph);
                        thisManager._createingPhantomjsInstance = false;
                    }, {
                        onExit: function() {
                            logging.log('phantomjs instance crashed or exited');
                            //FIXME: remove the crashed instance
                            //delete thisManager.phantomjsInstances[0];
                            //thisManager.phantomjsInstances.splice(0, 1);
                        }
                    });
                } else {
                    logging.log('Waiting creation of antoher phantomjs to be done');
                    setTimeout(function() {
                        thisManager.getPhantomInstance(callback);
                    }, 100);
                }
            } else {
                var ph = _.sample(thisManager.phantomjsInstances);
                logging.log('Got existing phantomjs instance');
                callback(ph);
            }
        },

        _createPage: function(callback) {
            var thisManager = this;
            logging.log('Creating new page');
            thisManager.getPhantomInstance(function(ph) {
                ph.createPage(function(page) {
                    page.belongingPhantomjs = ph;
                    thisManager._setupPage(page);
                    thisManager.workingPages.push(page);
                    logging.log(util.format('New page created under phantomjs(pid=%s)',
                                            page.belongingPhantomjs.process.pid));
                    callback(page);
                });
            });
        },

        /**
         * Get an available page instance
         */
        getPage: function(callback) {
            var thisManager = this;
            var page;

            if (thisManager.recycledPages.length > 0) {
                page = thisManager.recycledPages.splice(0, 1)[0];
                thisManager.workingPages.push(page);
                thisManager.tellState();
                callback(page);
            } else {
                thisManager._createPage(function(page) {
                    callback(page);
                    thisManager.tellState();
                });
            }
        },

        /**
         * Give back page to manager after used
         * The solution is buggy with nodejs
         * Resuse one page for different urls may lead phantomjs to crash, consider throwAway.
         */
        giveBack: function(page) {
            var thisManager = this;
            // NOTE: open `about:blank` leads phantomjs v1.9.0 to crash
            //page.open('about:blank', function() {
            //});
            thisManager.workingPages.forEach(function(p, idx) {
                if (page === p) {
                    thisManager.workingPages.splice(idx, 1);
                    thisManager.recycledPages.push(page);

                    logging.log(util.format('Recycled a page under phantomjs(pid=%s) by page manager',
                                            page.belongingPhantomjs.process.pid));
                    thisManager.tellState();
                }
            });
        },

        /**
         * Let manager close and throw away the page
         */
        throwAway: function(page) {
            var thisManager = this;
            thisManager.workingPages.forEach(function(p, idx) {
                if (page === p) {
                    thisManager.workingPages.splice(idx, 1);
                    logging.log(util.format('Thrown away a page under phantomjs(pid=%s) by page manager',
                                            page.belongingPhantomjs.process.pid));
                    page.close();
                    thisManager.tellState();
                }
            });
        },
    };
};
