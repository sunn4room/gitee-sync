# Gitee Sync with Puppeteer

```yaml
- name: [your job name]
  uses: sunn4room/gitee-sync@main
  with:
    username: [your gitee username]
    password: [your gitee password]
    token: [your gitee token] # not required
    # each line in repositories is a repo or organization
    #     repo format:          xxx/xxx
    #     organization format:  xxx
    # when organization, all repo under it will be sync.
    # if organization is private, your should provide gitee token
    repositories: |
      [your gitee repo/organization]
      [your gitee repo/organization]
      [your gitee repo/organization]
      [your gitee repo/organization]
```
