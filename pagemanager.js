/**
 * Manage pages like real web browser, with multiple windows.
 */

var logging = require('./utils/logging.js');
var webPage = require('webpage');

/**
 * Page manager factory
 * manager manages working pages and recycled pages
 */
module.exports.create = function(options) {
    var options = options || {};

    return {
        maxPages: 100,  // not implemented yet
        workingPages: [],
        recycledPages: [],
        excludes: options.excludes || [],  // regex patterns to exclude resources

        /**
         * Tell internal state
         */
        tellState: function() {
            logging.log('Page manager has',
                this.workingPages.length, 'working pages,',
                this.recycledPages.length, 'recycled pages'
            );
        },

        /**
         * Create a page instance
         */
        _createPage: function() {
            var thisManager = this;
            var page = webPage.create();
            page.settings.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.130 Safari/537.36';

            page.onUrlChanged = function(targetUrl) {
                logging.log('New URL: ' + targetUrl);
            };

            page.onClosing = function(closingPage) {
                logging.log('Closing page, URL: ', closingPage.url);
            };

            page.onResourceRequested = function(requestData, networkRequest) {
                //logging.log('Request#' + requestData.id, requestData.url);
                thisManager.excludes.forEach(function(pat) {
                    if(pat.test(requestData.url)) {
                        networkRequest.abort();
                    }
                });
            };
            //page.onResourceReceived = function(response) {
            //    logging.log('Response#' + response.id, response.stage, response.url);
            //};

            this.workingPages.push(page);
            return page;
        },

        /**
         * Get an available page instance
         */
        getPage: function() {
            var page;

            if (this.recycledPages.length > 0) {
                page = this.recycledPages.splice(-1)[0];
                this.workingPages.push(page);
            } else {
                page = this._createPage()
            }

            this.tellState();
            return page;
        },

        /**
         * Give back page to manager after used
         */
        giveBack: function(page) {
            var thisManager = this;
            page.open('about:blank', function() {
                thisManager.workingPages.forEach(function(p, idx) {
                    if (page === p) {
                        thisManager.recycledPages.push(page);
                        thisManager.workingPages.splice(idx, 1);

                        logging.log('Recycled one page by page manager');
                        thisManager.tellState();
                    }
                });
            });
        }
    }
};
