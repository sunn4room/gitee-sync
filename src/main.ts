import { get_org_repos, login, sync_repo } from './gitee'
import { get_browser } from './browser'
import { getInput, getMultilineInput, setFailed, info, startGroup, endGroup } from '@actions/core'
import { Browser } from 'puppeteer'

function handle_error(e: any): void {
  setFailed(e instanceof Error ? e.message : `Unknow: ${e}`)
}

async function login1(browser: Browser, username: string, password: string): Promise<void> {
  try {
    const login_page = await browser.newPage()
    await login_page.goto("https://gitee.com/login#lang=zh-CN", { waitUntil: 'domcontentloaded' })
    const username_selector = "#user_login"
    const password_selector = "#user_password"
    const login_btn_selector = "input[name=commit]"
    await Promise.all([
      login_page.waitForSelector(username_selector),
      login_page.waitForSelector(password_selector),
      login_page.waitForSelector(login_btn_selector)
    ])
    await login_page.type(username_selector, username)
    await login_page.type(password_selector, password)
    await Promise.all([
      login_page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      login_page.click(login_btn_selector)
    ])
    await login_page.close()
    info("gitee logged in")
  } catch {
    throw new Error("cannot login")
  }
}

export default async function(): Promise<void> {
  try {
    const username = getInput('username', { required: true })
    const password = getInput('password', { required: true })
    const token = getInput('token', { required: false })
    const repositories = getMultilineInput('repositories', { required: true })

    const browser = await get_browser({
      headless: 'new',
    })

    // await login(browser, username, password)
    //
    // for (const repo of repos) {
    //   if (repo.indexOf('/') >= 0) {
    //     await sync_repo(browser, repo).catch(e => handle_error(e))
    //   } else {
    //     let org_repos: Array<string>
    //     try {
    //       org_repos = await get_org_repos(repo, token)
    //     } catch(e) {
    //       handle_error(e)
    //       continue
    //     }
    //     for (const org_repo of org_repos) {
    //       await sync_repo(browser, org_repo).catch(e => handle_error(e))
    //     }
    //   }
    // }
    //
    // await browser.close()

    await login1(browser, username, password)

  const sync = async (repo: string) => {
    try {
      const repo_page = await browser.newPage()
      await repo_page.goto("https://gitee.com/" + repo, { waitUntil: 'domcontentloaded' })
      const sync_btn_selector = "#btn-sync-from-github"
      const confirm_btn_selector = "#modal-sync-from-github > .actions > .orange.ok"
      await repo_page.waitForSelector(sync_btn_selector)
      await repo_page.click(sync_btn_selector)
      await repo_page.waitForSelector(confirm_btn_selector)
      await Promise.all([
        repo_page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        repo_page.evaluateHandle(() => {
          const confirm = document.querySelector("#modal-sync-from-github > .actions > .orange.ok") as any
          confirm.click()
        })
      ])
      await repo_page.close()
      info(repo + " succeeded")
    } catch(e) {
      setFailed(repo + " failed: " + (e as Error).toString())
    }
  }

  const reposs: Array<string> = []
  for (const repo of repositories) {
    if (repo.indexOf("/") >= 0) {
      reposs.push(repo)
    } else {
      (await get_org_repos(repo)).forEach(i => reposs.push(i))
    }
  }
  startGroup("all repos here")
  reposs.forEach(repo => info(repo))
  endGroup()

  for (const repo of reposs) {
    await sync(repo)
  }

  await browser.close()
  } catch(e) {
    handle_error(e)
  }
}
