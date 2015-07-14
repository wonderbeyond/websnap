Simple web snapshot service
===========================

Include a raw phantomjs implementation and a nodejs implementation.
The phantomjs version(named in *-phantom.js) is only for reference,
only the nodejs version will be maintained.

## Setup

First, make sure [PhantomJS 2.0](http://phantomjs.org/download.html) is installed.

Then, clone this repository, and install required modules:

```bash
git clone git@github.com:wonderbeyond/websnap.git
cd websnap
npm install
```

## Play

Run the websnap server:

```bash
node websnap.js
```

Get a base64 string of a url:

> $ echo -n 'http://www.jjmmw.com/fund/daogou/' | base64
> aHR0cDovL3d3dy5qam1tdy5jb20vZnVuZC9kYW9nb3Uv

Request the websnap server to get the fully rendered DOM content:

```bash
curl "127.0.0.1:8300/snap/aHR0cDovL3d3dy5qam1tdy5jb20vZnVuZC9kYW9nb3Uv"
```
