var util = require('util');
var express = require('express');
var querystring = require('querystring');
var logging = require('./utils/logging.js');
var pageManager = require('./pagemanager.js').create({
    excludes: [
        /\bgoogle\b/,
        /\byahoo\b/,
        /\bhm\.baidu\.com\b/,
        /.*.(gif|jpg|jpeg|png|css)[\#\?]?/,
        /ajax\/funddata\.js/
    ]
});

var takeSnapshot = function(url, callback) {
    /*
     * TODO:
     * - handle non-200
     */
    var waitingTimeAfterPageLoad = 0;

    pageManager.getPage(function(page) {
        logging.log('Got a page for rendering');
        page.open(url, function(status) {
            if (status === "success") {
                logging.log('Successfully loaded', url);
                // NOTE: just wating is not safe!
                page.onPageIdle(function() {
                    logging.log('Capturing DOM of', url);
                    page.evaluate(function() {
                        if (!document || !document.body) {
                            return null;
                        }
                        document.body.bgColor = 'white';
                        return document.getElementsByTagName('html')[0].outerHTML;
                    }, function(htmlText) {
                        callback(htmlText);
                        pageManager.throwAway(page);
                    });
                });
            } else {
                logging.log('Failed to load', url);
                pageManager.throwAway(page);
            }
        });
    });
};

/**
 * TODO: wait-for support(Wait-For-Selector, Wait-For-Console, Wait-For-Event)
 */
var webapp = express();
webapp.get(/snap\/(.*)/, function(req, res) {
    /**
     * Request url example:
     * http "http://127.0.0.1:8300/snap/base64-of-forwarded-url"
     */
    logging.log("Got request", req.url);
    var targetUrl = new Buffer(req.params[0] ,'base64').toString().trim();
    logging.log("Start taking snapshot for", targetUrl);
    takeSnapshot(targetUrl, function(htmlText) {
        res.status(200);
        res.set({
            'Content-Type': 'text/html'
        })
        res.send(htmlText);
    });
});
webapp.get('/state', function(req, res) {
    res.json(pageManager.loadState());
});
webapp.listen(8300);
