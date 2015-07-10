var http = require('http');
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
http.createServer(function(req, res) {
    logging.log("Got request", req.url);
    var urlBase64 = decodeURIComponent(req.url.trim()).slice(1);
    var targetUrl = new Buffer(urlBase64, 'base64').toString().trim(); // decode from base64
    logging.log("Start taking snapshot for", targetUrl);

    takeSnapshot(targetUrl, function(htmlText) {

        res.writeHead(200, {
            'Content-Type': 'text/html'
        });

        res.end(htmlText);
    });

}).listen(8300);
