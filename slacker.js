'use strict';

const GitHub = require('github-api'),
   cron = require('node-cron'),
   Slack = require('slack-node'),
   cfenv = require('cfenv');

let LATEST_CF_RELEASE = null;
let LATEST_CAPI_RELEASE = null;

const gh = new GitHub({
   token: process.env.GITHUB_TOKEN
});
const cfRelease = gh.getRepo('cloudfoundry', 'cf-release');
const capiRelease = gh.getRepo('cloudfoundry', 'capi-release');

var slack = null;

function checkForNewCFRelease() {
   cfRelease.listReleases(function(err, data) {
      if (err) {
         console.error('Error getting release data: ' + err);
         return;
      }
      var release = data[0].tag_name;
      if ((LATEST_CF_RELEASE != null) && (release != LATEST_CF_RELEASE)) {
         console.log('New release detected: ' + release);
         generateNotification('New CF release detected: ' + release);
      }
      LATEST_CF_RELEASE = release;
   });
}

function checkForNewCapiRelease() {
   capiRelease.listReleases(function(err, data) {
      if (err) {
         console.error('Error getting release data: ' + err);
         return;
      }
      var release = data[0].tag_name;
      if ((LATEST_CAPI_RELEASE != null) && (release != LATEST_CAPI_RELEASE)) {
         console.log('New release detected: ' + release);
         generateNotification('New CAPI release detected: ' + release);
      }
      LATEST_CAPI_RELEASE = release;
   });
}

function generateNotification(message) {
   slack.webhook({
      channel: `#${process.env.SLACK_CHANNEL}`,
      username: 'Release Tracker',
      text: message,
      attachments: [
         {
            color: '#D50000',
            fields: [
               {
                  title: 'See what changes made it into this release',
                  value: cfenv.getAppEnv().url,
                  short: false
               }
            ]
         }
      ]
   }, function(err, response) {
      if (err) {
         console.error('Error sending slack message: ' + err);
         return;
      }
      console.log('Slack notification sent');
   });
}

function startTracking() {
   if (process.env.SLACK_WEBHOOK == null || process.env.SLACK_CHANNEL == null) {
      return;
   }
   slack = new Slack();
   slack.setWebhook(process.env.SLACK_WEBHOOK);
   checkForNewCFRelease();
   checkForNewCapiRelease();
   cron.schedule('*/5 * * * *', checkForNewCFRelease).start();
   cron.schedule('*/5 * * * *', checkForNewCapiRelease).start();
   console.log('Slack integration enabled');
}

exports.startTracking = startTracking;
exports.generateNotification = generateNotification;
