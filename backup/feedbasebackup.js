var myProductName = "feedBaseBackup", myVersion = "0.4.0";     

const mysql = require ("mysql");
const utils = require ("daveutils");
const fs = require ("fs");
const s3 = require ("daves3"); 

var config = {
	backupFolderPath: ""
	};
const fnameConfig = "config.json";

function encode (s) {
	return (mysql.escape (s));
	}
function encodeValues (values) {
	var part1 = "", part2 = "";
	for (var x in values) { //generate something like this: (feedurl, title, htmlurl, description, whenupdated)
		if (part1.length > 0) {
			part1 += ", ";
			}
		part1 += x;
		}
	for (var x in values) { //and this: ('http://scripting.com/rss.xml', Scripting News', 'http://scripting.com/', 'Even worse etc', '2018-02-04 12:04:08')
		if (part2.length > 0) {
			part2 += ", ";
			}
		part2 += encode (values [x]);
		}
	return ("(" + part1 + ") values (" + part2 + ");");
	}
function runSqltext (s, callback) {
	theSqlConnectionPool.getConnection (function (err, connection) {
		if (err) {
			console.log ("runSqltext: err.code == " + err.code + ", err.message == " + err.message);
			}
		else {
			connection.query (s, function (err, result) {
				connection.release ();
				if (err) {
					console.log ("runSqltext: err.code == " + err.code + ", err.message == " + err.message);
					if (callback !== undefined) {
						callback (undefined);
						}
					}
				else {
					if (callback !== undefined) {
						callback (result);
						}
					}
				});
			}
		});
	}
function backupSubscriptions (callback) {
	var sqltext = "select * from subscriptions;";
	runSqltext (sqltext, function (result) {
		var subs = new Array ();
		for (var i = 0; i < result.length; i++) {
			subs.push (result [i]);
			}
		callback (subs);
		});
	}
function backupFeeds (callback) {
	var sqltext = "select * from feeds;";
	runSqltext (sqltext, function (result) {
		var feeds = new Array ();
		for (var i = 0; i < result.length; i++) {
			feeds.push (result [i]);
			}
		callback (feeds);
		});
	}
function writeBackupFile (theData, fname, callback) {
	var f = config.backupFolderPath + fname;
	utils.sureFilePath (f, function () {
		var jsontext = utils.jsonStringify (theData);
		fs.writeFile (f, jsontext, function (err) {
			var f = config.backupFolderPath + utils.getDatePath (undefined, true) + fname;
			utils.sureFilePath (f, function () {
				fs.writeFile (f, jsontext, function (err) {
					console.log ("writeBackupFile: " + fname + " is " + utils.megabyteString (jsontext.length));
					if (callback !== undefined) {
						callback ();
						}
					});
				});
			});
		});
	}
function readConfig (callback) {
	utils.sureFilePath (fnameConfig, function () {
		fs.readFile (fnameConfig, function (err, data) {
			if (!err) {
				try {
					var jstruct = JSON.parse (data.toString ());
					for (var x in jstruct) {
						config [x] = jstruct [x];
						}
					}
				catch (err) {
					console.log ("readConfig: err == " + err.message);
					}
				}
			if (callback !== undefined) {
				callback ();
				}
			});
		});
	}
function doBackup () {
	var whenstart = new Date ();
	backupFeeds (function (theFeeds) {
		writeBackupFile (theFeeds, "feeds.json", function () {
			theFeeds = []; //reclaim memory used by the array
			backupSubscriptions (function (theSubs) {
				writeBackupFile (theSubs, "subscriptions.json", function () {
					console.log ("doBackup: backup took " + utils.secondsSince (whenstart) + " secs.");
					});
				});
			});
		});
	}
function everyMinute () {
	var now = new Date (), timestring = now.toLocaleTimeString ();
	console.log (myProductName + " v" + myVersion + ": " + timestring + ".\n");
	if ((now.getMinutes () % 20) == 0) { //every twenty minutes do a backup
		doBackup ();
		}
	}
readConfig (function () {
	console.log ("config == " + utils.jsonStringify (config));
	theSqlConnectionPool = mysql.createPool (config.database);
	doBackup ();
	utils.runAtTopOfMinute (function () {
		setInterval (everyMinute, 60000); 
		everyMinute ();
		});
	});
