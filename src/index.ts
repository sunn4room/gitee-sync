import { info, warning, setFailed, getInput, getMultilineInput } from "@actions/core"
import { launch } from "puppeteer"
import { downloadBrowser } from "puppeteer/lib/cjs/puppeteer/node/install.js"

(async () => {

  const username = getInput("username", { required: true })
  const password = getInput("password", { required: true })
  const repositories = getMultilineInput("repositories", { required: true })

  await downloadBrowser().catch(() => {
    throw new Error("cannot download browser")
  })

  const browser = await launch({
    headless: "new",
    args: ["--lang=zh-CN"],
  }).catch(() => {
    throw new Error("cannot launch browser")
  })

  const goto = async (url: string, until: any = "domcontentloaded") => {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: until }).catch(() => {})
    return page
  }

  try {
    const login_page = await goto("https://gitee.com/login#lang=zh-CN")
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
      login_page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      login_page.click(login_btn_selector)
    ])
    await login_page.close()
  } catch {
    throw new Error("cannot login")
  }

  const sync = async (repo: string) => {
    try {
      const repo_page = await goto("https://gitee.com/" + repo)
      const sync_btn_selector = "#btn-sync-from-github"
      const confirm_btn_selector = "#modal-sync-from-github > .actions > .orange.ok"
      await repo_page.waitForSelector(sync_btn_selector)
      await repo_page.click(sync_btn_selector)
      await repo_page.waitForSelector(confirm_btn_selector)
      await Promise.all([
        repo_page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        repo_page.evaluateHandle(() => {
          const confirm = document.querySelector("#modal-sync-from-github > .actions > .orange.ok") as any
          confirm.click()
        })
      ])
      await repo_page.close()
      info(repo)
    } catch {
      warning(repo)
      throw new Error("Please read the warning message")
    }
  }

  class LimitPromise {
    private limit: number
    private count: number
    private taskQueue: any[]

    constructor(limit: number) {
      this.limit = limit
      this.count = 0
      this.taskQueue = []
    }

    private createTask(
      asyncFn: Function,
      args: any[],
      resolve: (value: void) => void,
      reject: (reason?: any) => void
    ) {
      return () => {
        asyncFn(...args)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.count--
            if (this.taskQueue.length) {
              let task = this.taskQueue.shift()
              task()
            }
          })

        this.count++
      }
    }

    public call(asyncFn: Function, ...args: any[]) {
      return new Promise<void>((resolve, reject) => {
        const task = this.createTask(asyncFn, args, resolve, reject)
        if (this.count >= this.limit) {
          this.taskQueue.push(task)
        } else {
          task()
        }
      })
    }
  }

  const promises: Promise<void>[] = []
  const promise_limiter = new LimitPromise(5)
  repositories.forEach(async (repo) => {
    promises.push(promise_limiter.call(sync, repo))
  })
  await Promise.all(promises)

  await browser.close()

})().catch((e: Error) => {
  setFailed(e)
})
