import { get_org_repos, login, sync_repo } from './gitee'
import { get_browser } from './browser'
import { getInput, getMultilineInput, setFailed, info } from '@actions/core'

function handle_error(e: any): void {
  setFailed(e instanceof Error ? e.message : `Unknow: ${e}`)
}

export default async function(): Promise<void> {
  try {
    const username = getInput('username', { required: true })
    const password = getInput('password', { required: true })
    const token = getInput('token', { required: false })
    const repos = getMultilineInput('repositories', { required: true })

    const browser = await get_browser({
      headless: 'new',
    })

    await login(browser, username, password)

    for (const repo of repos) {
      if (repo.indexOf('/') >= 0) {
        await sync_repo(browser, repo).catch(e => handle_error(e))
      } else {
        let org_repos: Array<string>
        try {
          org_repos = await get_org_repos(repo, token)
        } catch(e) {
          handle_error(e)
          continue
        }
        for (const org_repo of org_repos) {
          await sync_repo(browser, org_repo).catch(e => handle_error(e))
        }
      }
    }

    await browser.close()
  } catch(e) {
    handle_error(e)
  }
}
