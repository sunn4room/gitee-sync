import { info } from '@actions/core'
import { HttpClient } from '@actions/http-client'
import { Browser, Page } from 'puppeteer'

class Stage {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

export class Gitee {
  #browser: Browser
  #maxPage: number
  #count: number
  #tasks: Array<() => Promise<void>>

  constructor(browser: Browser, maxPage?: number) {
    this.#browser = browser
    this.#maxPage = maxPage || 8
    this.#count = 0
    this.#tasks = []
  }

  async init(username: string, password: string) {
    const page = await this.#newpage()
    try {
      const url = 'https://gitee.com/login#lang=zh-CN'
      const username_selector = '#user_login'
      const password_selector = '#user_password'
      const commit_selector = 'input[name=commit]'
      await this.#goto(
        page,
        url,
        username_selector,
        password_selector,
        commit_selector,
      ).catch(() => {
        throw new Stage('open url')
      })
      await this.#type(page, username_selector, username).catch(() => {
        throw new Stage(`type into username input frame`)
      })
      await this.#type(page, password_selector, password).catch(() => {
        throw new Stage(`type into password input frame`)
      })
      await this.#click(page, commit_selector).catch(() => {
        throw new Stage(`commit username and password`)
      })
      info('gitee logged in')
    } catch (e) {
      if (e instanceof Stage) {
        throw new Error(`Cannot login gitee: ${e.name}`)
      } else {
        throw e
      }
    } finally {
      await page.close().catch()
    }
  }

  async sync(repo: string) {
    if (this.#count >= this.#maxPage) {
      await new Promise((res, rej) => {
        this.#tasks.push(() => {
          return this.#do_sync(repo).then(res).catch(rej)
        })
      })
    } else {
      await this.#do_sync(repo)
    }
  }

  async #do_sync(repo: string) {
    this.#count++
    const page = await this.#newpage()
    try {
      const url = `https://gitee.com/${repo}`
      const sync_selector = '#btn-sync-from-github'
      const confirm_selector = '#modal-sync-from-github > .actions > .orange.ok'
      const loading_selector = '#btn-sync-from-github > img.loading'
      await this.#goto(page, url, sync_selector).catch(() => {
        throw new Stage('open url')
      })
      await this.#click(page, sync_selector, [confirm_selector]).catch(() => {
        throw new Stage('click sync')
      })
      await Promise.all([
        page.waitForSelector(loading_selector),
        page.evaluateHandle(() => {
          const confirm = document.querySelector(
            '#modal-sync-from-github > .actions > .orange.ok',
          ) as HTMLDivElement | null
          if (confirm) confirm.click()
        }),
      ]).catch(() => {
        throw new Stage('confirm sync')
      })
      info(`"${repo}" synced`)
    } catch (e) {
      if (e instanceof Stage) {
        throw new Error(`Cannot sync "${repo}": ${e.name}`)
      } else {
        throw new Error(`Unknow error: ${e}`)
      }
    } finally {
      this.#count--
      const task = this.#tasks.shift()
      if (task) {
        task()
      }
      await page.close().catch()
    }
  }

  async close() {
    this.#browser.close()
  }

  async #goto(page: Page, url: string, ...selectors: Array<string>) {
    const promises: Array<Promise<unknown>> = selectors.map((selector) =>
      page.waitForSelector(selector),
    )
    promises.push(page.goto(url, { waitUntil: 'domcontentloaded' }))
    await Promise.all(promises)
  }

  async #click(page: Page, selector: string, waitFor?: Array<string>) {
    const promises: Array<Promise<unknown>> = []
    if (waitFor instanceof Array) {
      for (const selector of waitFor) {
        promises.push(page.waitForSelector(selector))
      }
    } else {
      promises.push(page.waitForNavigation({ waitUntil: 'domcontentloaded' }))
    }
    promises.push(page.click(selector))
    await Promise.all(promises)
  }

  async #type(page: Page, selector: string, content: string) {
    await page.type(selector, content)
  }

  async #newpage() {
    const page = await this.#browser.newPage()
    page.setDefaultNavigationTimeout(10000)
    page.setDefaultTimeout(10000)
    return page
  }
}

let client: HttpClient | undefined

function get_client(): HttpClient {
  if (client) {
    return client
  } else {
    client = new HttpClient()
    return client
  }
}

export async function* get_org_repos(org: string, token: string = '') {
  let count = 1
  while (true) {
    const result = await get_client().get(
      `https://gitee.com/api/v5/orgs/${org}/repos?type=all&per_page=100&page=${count}${
        token ? '&access_token=' + token : ''
      }`,
      {
        'content-type': 'application/json',
        charset: 'UTF-8',
      },
    )
    if (!result.message.statusCode || result.message.statusCode >= 400) {
      break
    }
    const data: Array<{ path: string }> = JSON.parse(await result.readBody())
    if (data.length == 0) {
      break
    } else {
      count += 1
    }
    for (const obj of data) {
      yield `${org}/${obj.path}`
    }
  }
}
