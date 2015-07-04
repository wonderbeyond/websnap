/**
 * Simple web snapshot service
 */
var logging = require('./utils/logging.js');
var fs = require('fs');
var server = require('webserver').create();
var dataDir = 'snapshots';

var pageManager = require('./pagemanager.js').create();

var takeSnapshot = function(url, callback) {
    /*
     * TODO:
     * - handle non-200
     * - exclude useless resources
     */
    var page = pageManager.getPage();

    page.open(url, function(status) {
        if (status === "success") {
            logging.log('Successfully taken snapshot for', url);
            var htmlText = page.evaluate(function() {
                document.body.bgColor = 'white';
                return document.getElementsByTagName('html')[0].outerHTML;
            });

            if (callback != undefined) {
                callback(htmlText, page);
            }

        } else {
            logging.log('Failed to take snapshot for', url);
        }
        //phantom.exit();
    });
};

server.listen(8200, function(request, response) {
    logging.log("Got request", request.url);
    var urlBase64 = decodeURIComponent(request.url.trim()).slice(1);
    var url = atob(urlBase64).trim(); // decode from base64
    logging.log("Start taking snapshot for", url);

    takeSnapshot(url, function(htmlText, page) {
        fs.write(dataDir + '/' + urlBase64 + '.html', htmlText, 'w');
        page.render(dataDir + '/' + urlBase64 + '.png');
        pageManager.giveBack(page);

        response.statusCode = 200;
        response.write(htmlText);
        response.close();
    });
});
