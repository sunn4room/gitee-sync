import { Gitee, get_org_repos } from './gitee'
import { getInput, getMultilineInput, setFailed } from '@actions/core'
import { launch } from 'puppeteer'
import { downloadBrowser } from 'puppeteer/lib/cjs/puppeteer/node/install.js'

function handle_error(e: any): void {
  setFailed(e instanceof Error ? e.message : `Unknow: ${e}`)
}

export default async function(): Promise<void> {
  try {

    const username = getInput('username', { required: true })
    const password = getInput('password', { required: true })
    const token = getInput('token', { required: false })
    const repos = getMultilineInput('repositories', { required: true })

    await downloadBrowser()
      .catch(() => { throw new Error('Cannot download browser') })
    const browser = await launch({ headless: 'new', args: ["--lang=zh-CN"] })
      .catch(() => { throw new Error('Cannot launch browser') })
    const gitee = new Gitee(browser)

    try {
      await gitee.init(username, password)

      const promises: Array<Promise<void>> = []
      for (const repo of repos) {
        if (repo.indexOf('/') >= 0) {
          promises.push(gitee.sync(repo).catch(e => handle_error(e)))
        } else {
          for await (const org_repo of get_org_repos(repo, token)) {
            promises.push(gitee.sync(org_repo).catch(e => handle_error(e)))
          }
        }
      }
      await Promise.all(promises)
    } catch(e) {
      handle_error(e)
    } finally {
      await gitee.close().catch()
    }

  } catch(e) {
    handle_error(e)
  }
}
