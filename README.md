# release-tracker

Track which commits, from a list of committers, make it into an official
[CF deployment](https://github.com/cloudfoundry/cf-deployment/releases) via the
[CAPI release](https://github.com/cloudfoundry/capi-release) and
[cloud_controller_ng](https://github.com/cloudfoundry/cloud_controller_ng/)
repos.

You will need a Github token to use this application. Follow the instructions
[here](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)
to generate a new token.

#### Adding a commiter to track
Add your Github username to [COMMITTERS.txt](./COMMITTERS.txt)

### Installation
```bash
npm install
```

### Running locally
```bash
GITHUB_TOKEN=<github-token> npm start
```

### Deploying to CF
```bash
cf push --no-start
cf set-env release-tracker GITHUB_TOKEN <token>
cf start release-tracker
```

If you would also like a Slack message alert when a new CF deployment is cut,
you should provide the `SLACK_WEBHOOK` and `SLACK_CHANNEL` environmental
variables. Webhooks usually look like `https://hooks.slack.com/services/xxx/xxx`.
```bash
cf set-env release-tracker SLACK_WEBHOOK <webhook>
cf set-env release-tracker SLACK_CHANNEL <channel>
```
