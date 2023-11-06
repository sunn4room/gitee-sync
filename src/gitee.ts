import { info } from '@actions/core'
import { HttpClient } from '@actions/http-client'
import { Browser } from 'puppeteer'

let client: HttpClient | undefined

function get_client(): HttpClient {
  return client ? client : new HttpClient()
}

export async function get_org_repos(org: string, token: string = ''): Promise<Array<string>> {
  const repos: Array<string> = []
  let count = 1
  while (true) {
    const result = await get_client().get(
      `https://gitee.com/api/v5/orgs/${org}/repos?type=all&per_page=100&page=${count}&${token ? '&access_token='+token : ''}`,
      {
        'content-type': 'application/json',
        'charset': 'UTF-8',
      }
    )
    if (!result.message.statusCode || result.message.statusCode >= 400) {
      throw new Error(`Cannot get repos from organization "${org}"`)
    }
    const data: Array<{path: string}> = JSON.parse(await result.readBody())
    if (data.length == 0) {
      break
    } else {
      count += 1
    }
    data.forEach(obj => repos.push(`${org}/${obj.path}`))
  }
  return repos
}

export async function login(browser: Browser, username: string, password: string): Promise<void> {
  try {
    const login_page = await browser.newPage()
    await login_page.goto('https://gitee.com/login')
    const username_selector = '#user_login'
    const password_selector = '#user_password'
    const login_btn_selector = 'input[name=commit]'
    await Promise.all([
      login_page.waitForSelector(username_selector),
      login_page.waitForSelector(password_selector),
      login_page.waitForSelector(login_btn_selector)
    ])
    await login_page.type(username_selector, username)
    await login_page.type(password_selector, password)
    await Promise.all([
      login_page.waitForNavigation(),
      login_page.click(login_btn_selector)
    ])
    await login_page.close()
    info('gitee logged in')
  } catch {
    throw new Error('Cannot login gitee')
  }
}

export async function sync_repo(browser: Browser, repo: string): Promise<void> {
  try {
    const repo_page = await browser.newPage()
    await repo_page.goto(`https://gitee.com/${repo}`)
    const sync_btn_selector = '#btn-sync-from-github'
    const confirm_btn_selector = '#modal-sync-from-github > .actions > .orange.ok'
    await repo_page.waitForSelector(sync_btn_selector)
    await repo_page.click(sync_btn_selector)
    await repo_page.waitForSelector(confirm_btn_selector)
    await Promise.all([
      repo_page.waitForNavigation(),
      repo_page.evaluateHandle(() => {
        const confirm = document.querySelector('#modal-sync-from-github > .actions > .orange.ok') as any
        confirm.click()
      })
    ])
    await repo_page.close()
    info(`"${repo}" synced`)
  } catch {
    throw new Error(`Cannot sync "${repo}"`)
  }
}
