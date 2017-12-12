'use strict';

const async = require('async'),
   fs = require('fs'),
   cron = require('node-cron'),
   GitHub = require('github-api'),
   moment = require('moment'),
   request = require('request'),
   yaml = require('js-yaml');

const gh = new GitHub({
   token: process.env.GITHUB_TOKEN
});

// Data (cached every 5 mins)
let CACHED_DATA = null;

// Commiters we care about
const COMMITTERS = fs.readFileSync('COMMITTERS.txt').toString().split('\n');

// Fetch required repos
const cfDeployment = gh.getRepo('cloudfoundry', 'cf-deployment');
const capiRelease = gh.getRepo('cloudfoundry', 'capi-release');
const cloudControllerNg = gh.getRepo('cloudfoundry', 'cloud_controller_ng');
let capiReleases = [];

function getCommitsInLatestReleases(callback) {
   // Get latest releases (tags)
   async.parallel({
      latestCfDeployments: function(cb) { cfDeployment.listReleases(cb) },
      latestCapiReleases: function(cb) { capiRelease.listReleases(cb) }
   },
   function(err, results) {
      if (err) {
         callback(err, null);
         return;
      }

      const latestTag = results.latestCfDeployments[0][0].tag_name;
      const previousTag = results.latestCfDeployments[0][1].tag_name;
      const olderTag = results.latestCfDeployments[0][2].tag_name;
      const oldererTag = results.latestCfDeployments[0][3].tag_name;

      // Save the CAPI releases as we will need them later
      capiReleases = results.latestCapiReleases[0];

      const latestCfDeployment = {
         name: results.latestCfDeployments[0][0].tag_name,
         date: generateDateString(results.latestCfDeployments[0][0].published_at),
         url: 'https://github.com/cloudfoundry/cf-deployment/releases/tag/' + results.latestCfDeployments[0][0].tag_name
      };
      const latestCapiRelease = {
         name: results.latestCapiReleases[0][0].tag_name,
         date: generateDateString(results.latestCapiReleases[0][0].published_at),
         url: 'https://github.com/cloudfoundry/capi-release/releases/tag/' + results.latestCapiReleases[0][0].tag_name
      };

      async.map(
         [
            [ results.latestCfDeployments[0][0].tag_name, results.latestCfDeployments[0][1].tag_name ],
            [ results.latestCfDeployments[0][1].tag_name, results.latestCfDeployments[0][2].tag_name ],
            [ results.latestCfDeployments[0][2].tag_name, results.latestCfDeployments[0][3].tag_name ]
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
               latestCfDeployment: latestCfDeployment,
               latestCapiRelease: latestCapiRelease
            });
      });
   });
}

function getChangesBetweenTags(cfDeploymentHead, cfDeploymentBase, callback) {
   async.parallel({
      capiHead: function(cb) { getCloudControllerSha(cfDeploymentHead, cb); },
      capiBase: function(cb) { getCloudControllerSha(cfDeploymentBase, cb); }
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
                  commit.prettyDate = moment(commit.commit.author.date).format('ddd MMMM Do');
                  sapiCommits.unshift(commit);
               }
            } catch (e) {
               //
            }
         });
         callback(null, {
            head: cfDeploymentHead,
            base: cfDeploymentBase,
            cf_release_url: 'https://github.com/cloudfoundry/cf-deployment/releases/tag/' + cfDeploymentHead,
            capi_release_url: 'https://github.com/cloudfoundry/capi-release/releases/tag/' + results.capiHead.capiReleaseTag,
            capi_version: results.capiHead.capiReleaseTag,
            commits: sapiCommits
         });
      });
   });
}

function getCloudControllerSha(sha, callback) {
   cfDeployment.getContents(sha, 'cf-deployment.yml', false, function(err, manifest) {
      if (err) {
         callback(err, null);
         return;
      }

      // Download the manifest
      request({
         url: manifest.download_url,
         headers: { 'User-Agent': 'request' }
      }, function (err, response, body) {
         if (err) {
            callback(err, null);
            return;
         }

         // Decode the YAML and get the CAPI release SHA
         let manifest = yaml.safeLoad(response.body, 'utf8');
         let capiReleaseTag = manifest.releases.filter(release => release.name == 'capi')[0].version;

         // Get the corresponding cloud_controller_ng SHA
         capiRelease.getContents(capiReleaseTag, 'src/cloud_controller_ng', false, function(err, ccContents) {
            if (err) {
               callback(err, null);
               return;
            }
            callback(null, {
               capiReleaseTag: capiReleaseTag,
               ccSha: ccContents.sha
            });
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
