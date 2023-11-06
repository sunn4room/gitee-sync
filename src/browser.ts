import puppeteer, { Browser, PuppeteerLaunchOptions } from 'puppeteer'
import { downloadBrowser } from 'puppeteer/lib/cjs/puppeteer/node/install.js'

export async function get_browser(options?: PuppeteerLaunchOptions | undefined): Promise<Browser> {
  await downloadBrowser()
  return await puppeteer.launch(options)
}
