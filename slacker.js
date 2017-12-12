'use strict';

const GitHub = require('github-api'),
   cron = require('node-cron'),
   Slack = require('slack-node'),
   cfenv = require('cfenv');

let LATEST_CF_DEPLOYMENT = null;
let LATEST_CAPI_RELEASE = null;

const gh = new GitHub({
   token: process.env.GITHUB_TOKEN
});
const cfDeployment = gh.getRepo('cloudfoundry', 'cf-deployment');
const capiRelease = gh.getRepo('cloudfoundry', 'capi-release');

var slack = null;

function checkForNewCFDeployment() {
   cfDeployment.listReleases(function(err, data) {
      if (err) {
         console.error('Error getting release data: ' + err);
         return;
      }
      var release = data[0].tag_name;
      if ((LATEST_CF_DEPLOYMENT != null) && (release != LATEST_CF_DEPLOYMENT)) {
         generateNotification('New CF deployment detected: ' + release);
      }
      LATEST_CF_DEPLOYMENT = release;
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

function test(request, response) {
   if (process.env.SLACK_WEBHOOK == null || process.env.SLACK_CHANNEL == null) {
      response.status(400).send('Missing required environmental variables');
      return;
   }
   generateNotification('Testing testing 1, 2, 3');
   response.send();
}

function startTracking() {
   // if (process.env.SLACK_WEBHOOK == null || process.env.SLACK_CHANNEL == null) {
   //    return;
   // }
   slack = new Slack();
   slack.setWebhook(process.env.SLACK_WEBHOOK);
   checkForNewCFDeployment();
   checkForNewCapiRelease();
   cron.schedule('*/5 * * * *', checkForNewCFDeployment).start();
   cron.schedule('*/5 * * * *', checkForNewCapiRelease).start();
   console.log('Slack integration enabled');
}

exports.startTracking = startTracking;
exports.generateNotification = generateNotification;
exports.test = test;
