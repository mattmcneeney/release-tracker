'use strict';

const async = require('async'),
   fs = require('fs'),
   cron = require('node-cron'),
   GitHub = require('github-api'),
   moment = require('moment');

const gh = new GitHub({
   token: process.env.GITHUB_TOKEN
});

// Data (cached every 5 mins)
let CACHED_DATA = null;

// Commiters we care about
const COMMITTERS = fs.readFileSync('COMMITTERS.txt').toString().split('\n');

// Fetch required repos
const cfRelease = gh.getRepo('cloudfoundry', 'cf-release');
const capiRelease = gh.getRepo('cloudfoundry', 'capi-release');
const cloudControllerNg = gh.getRepo('cloudfoundry', 'cloud_controller_ng');
let capiReleases = [];

function getCommitsInLatestReleases(callback) {
   // Get latest releases (tags)
   async.parallel({
      latestCfReleases: function(cb) { cfRelease.listReleases(cb) },
      latestCapiReleases: function(cb) { capiRelease.listReleases(cb) }
   },
   function(err, results) {
      if (err) {
         callback(err, null);
         return;
      }

      const latestTag = results.latestCfReleases[0][0].tag_name;
      const previousTag = results.latestCfReleases[0][1].tag_name;
      const olderTag = results.latestCfReleases[0][2].tag_name;
      const oldererTag = results.latestCfReleases[0][3].tag_name;

      // Save the CAPI releases as we will need them later
      capiReleases = results.latestCapiReleases[0];

      const latestCfRelease = {
         name: results.latestCfReleases[0][0].tag_name,
         date: generateDateString(results.latestCfReleases[0][0].published_at),
         url: 'https://github.com/cloudfoundry/cf-release/releases/tag/' + results.latestCfReleases[0][0].tag_name
      };
      const latestCapiRelease = {
         name: results.latestCapiReleases[0][0].tag_name,
         date: generateDateString(results.latestCapiReleases[0][0].published_at),
         url: 'https://github.com/cloudfoundry/capi-release/releases/tag/' + results.latestCapiReleases[0][0].tag_name
      };

      async.map(
         [
            [ results.latestCfReleases[0][0].tag_name, results.latestCfReleases[0][1].tag_name ],
            [ results.latestCfReleases[0][1].tag_name, results.latestCfReleases[0][2].tag_name ],
            [ results.latestCfReleases[0][2].tag_name, results.latestCfReleases[0][3].tag_name ]
         ],
         function(tags, callback) {
            getChangesBetweenTags(tags[0], tags[1], callback);
         },
         function(err, results) {
            if (err) {
               callback(err, null);
               return;
            }
            callback(null, {
               commitData: results,
               latestCfRelease: latestCfRelease,
               latestCapiRelease: latestCapiRelease
            });
      });
   });
}

function getChangesBetweenTags(cfReleaseHead, cfReleaseBase, callback) {
   async.parallel({
      capiHead: function(cb) { getCapiSha(cfReleaseHead, cb); },
      capiBase: function(cb) { getCapiSha(cfReleaseBase, cb); }
   },
   function(err, results) {
      if (err) {
         callback(err, null);
         return;
      }
      cloudControllerNg.compareBranches(results.capiBase.ccSha, results.capiHead.ccSha, function(err, data) {
         if (err) {
            callback(err, null);
            return;
         }
         let sapiCommits = [];
         data.commits.forEach(function(commit) {
            try {
               if (COMMITTERS.indexOf(commit.author.login) > -1) {
                  commit.prettyDate = moment(commit.author.date).format('ddd MMMM Do');
                  sapiCommits.unshift(commit);
               }
            } catch (e) {
               //
            }
         });
         callback(null, {
            head: cfReleaseHead,
            base: cfReleaseBase,
            cf_release_url: 'https://github.com/cloudfoundry/cf-release/releases/tag/' + cfReleaseHead,
            capi_release_url: 'https://github.com/cloudfoundry/capi-release/commit/' + results.capiHead.capiReleaseSha,
            capi_version: getCapiReleaseFromSha(results.capiHead.capiReleaseSha),
            commits: sapiCommits
         });
      });
   });
}

function getCapiReleaseFromSha(sha) {
   for (let i = 0; i < capiReleases.length; i++) {
      if (sha == capiReleases[i].target_commitish) {
         return capiReleases[i].tag_name;
      }
   }
   return 'not found';
}

function getCapiSha(sha, callback) {
   cfRelease.getContents(sha, 'src/capi-release', false, function(err, capiReleaseContents) {
      if (err) {
         callback(err, null);
         return;
      }
      capiRelease.getContents(capiReleaseContents.sha, 'src/cloud_controller_ng', false, function(err, ccContents) {
         if (err) {
            callback(err, null);
            return;
         }
         callback(null, {
            capiReleaseSha: capiReleaseContents.sha,
            ccSha: ccContents.sha
         });
      });
   });
}

function generateDateString(d) {
   const m = moment(d);
   return m.format('ddd MMMM Do') + ', ' + moment().diff(m, 'days') + ' days ago';
}

function updateData() {
   getCommitsInLatestReleases(function(err, data) {
      if (err) {
         console.error('error fetching data: ' + err);
         return;
      }
      CACHED_DATA = data;
   });
}

function start() {
   updateData();
   cron.schedule('*/5 * * * *', updateData).start();
}

function getData() {
   return CACHED_DATA;
}

exports.start = start;
exports.getData = getData;
