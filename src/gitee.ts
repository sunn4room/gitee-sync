import { info } from '@actions/core'
import { HttpClient } from '@actions/http-client'
import { Browser } from 'puppeteer'

let client: HttpClient | undefined

function get_client(): HttpClient {
  if (client) { return client }
  else {
    client = new HttpClient()
    return client
  }
}

export async function get_org_repos(org: string, token: string = ''): Promise<Array<string>> {
  const repos: Array<string> = []
  let count = 1
  while (true) {
    const result = await get_client().get(
      `https://gitee.com/api/v5/orgs/${org}/repos?type=all&per_page=100&page=${count}${token ? '&access_token='+token : ''}`,
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
  const login_page = await browser.newPage()
  try {
    await login_page.goto(
      'https://gitee.com/login#lang=zh-CN',
      { timeout: 10000, waitUntil: 'domcontentloaded' }
    ).catch(() => { throw new Error('Cannot open url') })
    await login_page.waitForTimeout(1000)
    const username_selector = '#user_login'
    const password_selector = '#user_password'
    const login_btn_selector = 'input[name=commit]'
    await Promise.all([
      login_page.waitForSelector(username_selector, { timeout: 10000 }),
      login_page.waitForSelector(password_selector, { timeout: 10000 }),
      login_page.waitForSelector(login_btn_selector, { timeout: 10000 })
    ]).catch(() => { throw new Error('Cannot find login elements') })
    await login_page.type(username_selector, username, { delay: 200 })
    await login_page.waitForTimeout(1000)
    await login_page.type(password_selector, password, { delay: 200 })
    await login_page.waitForTimeout(1000)
    await Promise.all([
      login_page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }),
      login_page.click(login_btn_selector)
    ]).catch(() => { throw new Error('No response after submit') })
    info('gitee logged in')
  } catch(e) {
    throw new Error(`Cannot login gitee${e instanceof Error ? ': '+e.message : ''}`)
  } finally {
    await login_page.close()
  }
}

export async function sync_repo(browser: Browser, repo: string): Promise<void> {
  const repo_page = await browser.newPage()
  try {
    await repo_page.goto(
      `https://gitee.com/${repo}`,
      { timeout: 10000, waitUntil: 'domcontentloaded' }
    ).catch(() => { throw new Error('Cannot open url') })
    await repo_page.waitForTimeout(1000)
    const sync_btn_selector = '#btn-sync-from-github'
    const confirm_btn_selector = '#modal-sync-from-github > .actions > .orange.ok'
    await repo_page.waitForSelector(
      sync_btn_selector, { timeout: 10000 }
    ).catch(() => { throw new Error('Cannot find sync element') })
    await repo_page.click(sync_btn_selector)
    await repo_page.waitForTimeout(1000)
    await repo_page.waitForSelector(
      confirm_btn_selector, { timeout: 10000 }
    ).catch(() => { throw new Error('Cannot find confirm element') })
    await repo_page.waitForTimeout(1000)
    await Promise.all([
      repo_page.waitForNavigation({ timeout: 60000, waitUntil: 'domcontentloaded' }),
      repo_page.evaluateHandle(() => {
        const confirm = document.querySelector('#modal-sync-from-github > .actions > .orange.ok') as any
        confirm.click()
      })
    ]).catch(() => { throw new Error('No response after confirm') })
    info(`"${repo}" synced`)
  } catch(e) {
    throw new Error(`Cannot sync "${repo}"${e instanceof Error ? ': '+e.message : ''}`)
  } finally {
    await repo_page.close()
  }
}
