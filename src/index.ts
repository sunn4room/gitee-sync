import { info, warning, error, getInput } from "@actions/core"
import { launch } from "puppeteer"
import { downloadBrowser } from "puppeteer/lib/cjs/puppeteer/node/install.js"

(async () => {

  const username = getInput("username", { required: true })
  const password = getInput("password", { required: true })
  const repositories = getInput("repositories", { required: true })

  await downloadBrowser().catch(() => {
    throw new Error("cannot download browser")
  })

  const browser = await launch({ headless: "new" }).catch(() => {
    throw new Error("cannot launch browser")
  })

  const goto = async (url: string) => {
    const page = await browser.newPage()
    await page.goto(url)
    return page
  }

  try {
    const login_page = await goto("https://gitee.com/login")
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
      login_page.waitForNavigation(),
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
        repo_page.waitForNavigation(),
        repo_page.evaluateHandle(() => {
          const confirm = document.querySelector("#modal-sync-from-github > .actions > .orange.ok") as any
          confirm.click()
        })
      ])
      await repo_page.close()
      info(repo)
    } catch {
      warning(repo)
    }
  }

  repositories.split("\n").forEach((repo) => {
    if (repo.indexOf("/") >= 0) {
      sync(repo)
    }
  })

  await browser.close()

})().catch((e: Error) => {
  error(e.message)
})
