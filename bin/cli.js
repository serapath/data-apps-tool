#!/usr/bin/env node
/******************************************************************************
  DATA APPS TOOL
******************************************************************************/
const Reset = "\x1b[0m"
const FgMagenta = "\x1b[35m"
const FgCyan = "\x1b[36m"
const FgYellow = "\x1b[33m"
const FgBlue = "\x1b[34m"
const FgGray = "\x1b[90m"
const FgGreen = "\x1b[32m"
const FgRed = "\x1b[31m"
const chokidar_color = FgMagenta
const ws_color = FgCyan
const http_color = FgYellow
const info_color = FgGray
const host = 'localhost'
const port = 10000
const base = process.cwd()
const http_url = `http://${host}:${port}`
const ws_url = `ws://${host}:${port}`
/*****************************************************************************/
const [mode, ...rest] = process.argv.slice(2)
switch (mode) {
  case 'portal': return portal(...rest)
  case 'help':
  default: help(...rest)
}
/******************************************************************************
  help
******************************************************************************/
function help () {
  console.log(info_color, '[info]', Reset, 'try: `data-apps-tool portal [filename]`')
}
/******************************************************************************
  portal
******************************************************************************/
async function portal (mainpath = 'index.js') {
  const { createServer } = require('http')
  const { parse } = require('url')
  const { join, extname, normalize } = require('path')
  const { existsSync, createReadStream, statSync, promises: fs } = require('fs')
  const { exec } = require('child_process')
  const { Readable } = require('stream')
  const chokidar = require('chokidar')
  const WebSocket = require('ws')
  const goodbye = require('graceful-goodbye')
  // --------------------------------------------------------------------------
  const ignored = ignore('node_modules', '.git', 'index.json', 'index.html', '.gitignore')
  const chokidar_opts = {
    // awaitWriteFinish: true,
    // atomic: true,
    followSymlinks: false,
    ignoreInitial: true,
    ignored
  }
  const MIME = {
    // maps file extention to MIME types
    // full list can be found here:
    // => https://www.freeformatter.com/mime-types-list.html
    // @TODO: add as needed!
    '.html' : 'text/html',
    '.css'  : 'text/css',
    '.json' : 'application/json',
    '.svg'  : 'image/svg+xml',
    '.js'   : 'text/javascript',
    '.cjs'  : 'text/javascript',
    '.mjs'  : 'text/javascript',
    '.wav'  : 'audio/wav',
    '.mp3'  : 'audio/mpeg',
    '.mp4'  : 'video/mp4',
    '.jpeg' : 'image/jpeg',
    '.jpg'  : 'image/jpeg',
    '.png'  : 'image/png',
    '.ico'  : 'image/x-icon',
    '.pdf'  : 'application/pdf',
    '.zip'  : 'application/zip',
    '.doc'  : 'application/msword',
    '.eot'  : 'application/vnd.ms-fontobject',
    '.ttf'  : 'application/x-font-ttf',
  }
  mainpath = join('/', mainpath)
  // --------------------------------------------------------------------------
  const server = createServer(http_handler)
  const wss = new WebSocket.Server({ server })
  goodbye(shutdown)
  const files = await index_files(ignored)
  const save = debounce(save_files)
  await save(files)
  chokidar.watch('.', chokidar_opts).on('all', file_handler)
  wss.on('connection', ws_handler)
  server.listen(port, onready)
  /**************************************
    INFO handler
  **************************************/
  function open (url) {
    console.log(info_color, '[info]', Reset, 'open', url)
    exec((process.platform.replace('darwin','').replace(/win32|linux/,'xdg-') + 'open ' + url))
  }
  function onready () {
    open(http_url)
    console.log(info_color, '[info]', Reset, `Static web file watch server running at: ${http_url}\n\nCTRL + C to shutdown\n`)
  }
  async function save_files (files) {
    const filename = join(base, 'index.json')
    const json = JSON.stringify(files, null, 2)
    await fs.writeFile(filename, json)
    console.log(info_color, '[info]', Reset, `${files.length} file paths written to "./index.json"`)
    return true
  }
  function debounce (f, delay = 300, tid, ok) {
    return async (...args) => {
      function task () { try { resolve(f(...args)) } catch (e) { reject(e) } }
      var resolve, reject, promise = new Promise((ok, ko) => { resolve = ok; reject = ko })
      clearTimeout(tid)
      if (ok) ok(false)
      ok = resolve
      tid = setTimeout(task, delay)
      return promise
    }
  }
  async function shutdown () {
    wss.clients.forEach(client => client.send(JSON.stringify({ type: 'exit' })))
    console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
    process.exit(0)
  }
  /**************************************
    FILE handler
  **************************************/
  function file_handler (type, path) {
    console.log(chokidar_color, '[watch]', Reset, FgBlue, type, Reset, path)
    wss.clients.forEach(client => {
      // @TODO: update `index.json`
      if (client.readyState !== WebSocket.OPEN) return
      const data = { type, path }
      const isBinary = false
      client.send(JSON.stringify(data), { binary: isBinary })
    })
  }
  function ignore (...ignored) {
    return path => ignored.some(prefix => path.startsWith(prefix))
  }
  async function index_files (ignored) {
    const files = []
    await walk(base)
    files.sort()
    return files
    async function walk (current_path, relative_path = '') {
      const entries = await fs.readdir(current_path, { withFileTypes: true })
      for (const entry of entries) {
        const abs_path = join(current_path, entry.name)
        const rel_path = join(relative_path, entry.name)
        const std_path = normalize(rel_path)
        if (ignored(std_path)) continue
        if (entry.isDirectory()) await walk(abs_path, rel_path)
        else files.push(std_path)
        console.log(`${chokidar_color} %s ${FgBlue}%s ${Reset}`, '[index]', std_path)
      }
    }
  }
  /**************************************
    HTTP handler
  **************************************/
  function http_handler (request, response) {
    const url = parse(request.url)
    const uri = url.pathname === '/' ? '/index.html' : url.pathname
    // SECURITY: extract URL path
    // Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
    // e.g curl --path-as-is http://localhost:9000/../fileInDanger.txt
    // by limiting the path to current directory only
    const sanitized_path = normalize(uri).replace(/^(\.\.[\/\\])+/, '')
    const filepath = join(base, sanitized_path)
    const exists = existsSync(filepath)
    const stat = exists ? statSync(filepath) : {}
    const home = sanitized_path === '/index.html'
    const headers = {}
    const mimetype = MIME[extname(filepath)]
    if (mimetype) headers['Content-Type'] = mimetype
    if (stat.ctime) headers['eTag'] = stat.ctime
    const [status, stream] = exists ? stat.isDirectory()
      ? [404, index_html()]
      : [200, createReadStream(filepath, { encoding: 'utf8' }) ]
      : [home ? 200 : 404, index_html()]
    response.writeHead(status, headers)
    stream.on('error', error => {
      response.writeHead(500, { 'Content-Type': 'text/plain' })
      response.write(error + '\n')
      stream.end()
      response.end()
      goodbye.exit()
    })
    const color = status === 200 ? FgGreen : FgRed
    console.log(`${http_color} %s ${color}%s ${Reset}`, '[http]', status, `${request.method} ${sanitized_path}`)
    stream.pipe(response)
  }
  /**************************************
    WS handler
  **************************************/
  function ws_handler (ws) {
    ws.on('error', console.error)
    ws.on('close', () => console.log(ws_color, '[ws]', Reset, 'client disconnected'))
    ws.on('message', data => {
      console.log(ws_color, '[ws]', Reset, 'received: %s', data)
    })
    console.log(ws_color, '[ws]', Reset, 'client connected')
  }
  /**************************************
    BROWSER: index.html
  **************************************/
  function index_html () {
    const dataToStream = `<!DOCTYPE html>
  <html>
    <head><meta charset="utf-8"><link rel="icon" href="data:,"></head>
    <body>
      <script>(${script})("${ws_url}")</script>
      <script src="${mainpath}"></script>
    </body>
  </html>`.split('\n').map(str => str + '\n')
    const myReadable = new Readable({
      read () { // The consumer is ready for more data
        this.push(dataToStream.shift())
        if (!dataToStream.length) this.push(null) // End the stream
      }
    })
    return myReadable
    function script (ws_url, state = { ws: null, files: null, version: null }) {
      const paths_json = '/index.json'
      const { href } = new URL(paths_json, location)
      document.body.style = `background-color: black;, color: lime; font-family: mono;`
      const to = { ws: null, files: null }
      window.vault = { on, burnthemall }
      retry(connect)
      update()
      function on (type, callback) {
        to[type] = callback
        if (state[type]) callback(state[type])
      }
      async function burnthemall () { localStorage.clear() }
      async function update () {
        try {
          const { headers, status } = await fetch(href, { method: 'head' }) // very lightweight quick request
          const eTag = headers.get('eTag') // webservers like github pages set this header to indicate changes since last visit
          if (status !== 200) console.error(`404 - "${paths_json}" does not exist`)
          else if (eTag === localStorage.eTag) to?.files?.(JSON.parse(localStorage.files), eTag)
          else {
            try {
              const json = await (await fetch(href)).text()
              const files = state.files = JSON.parse(localStorage.files = json)
              const version = state.version = localStorage.eTag = eTag
              to?.files?.(files, version)
            } catch (error) { console.error(`could not fetch "${paths_json}"`, error) }
          }
        } catch (error) { console.error(error) }
      }
      function reload () { location.reload() }
      async function retry (fn, depth = 0, wait) {
        if (!wait) wait = ms => new Promise(ok => setTimeout(ok, ms))
        try {
          state.ws = await fn()
          to?.ws?.(state.ws)
        }
        catch (e) {
          if (depth > 7) throw e
          await wait(2 ** depth * 10)
          return retry(fn, depth + 1, wait)
        }
      }
      async function connect () {
        const { resolve, reject, promise } = Promise.withResolvers()
        const ws = new WebSocket(ws_url)
        ws.onerror = () => reject('fail')
        ws.onclose = () => reject('closed')
        ws.onopen = onopen
        return promise
        function onopen () {
          const on = {
            exit ()          { window.close() },
            // --------------------------------
            add (path)       { console.log('make', path); reload() },     // create file
            change (path)    { console.log('edit', path); reload() },     // update file
            unlink (path)    { console.log('drop', path); reload() },     // delete file
            addDir (path)    { console.log('make-dir', path); reload() }, // create dir
            unlinkDir (path) { console.log('make-dir', path); reload() }, // delete dir
          }
          ws.onmessage = onmessage
          resolve(ws)
          async function onmessage ({ data }) {
            try {
              const { type, path } = JSON.parse(data)
              const action = on[type]
              if (!action) throw new Error(`unknown type: "${type}"`)
              const el = document.createElement('pre')
              el.textContent = JSON.stringify({ type, path }, 0, 2)
              document.body.append(el)
              action(path)
            } catch (error) {
              console.error(error)
              ws.close()
              retry(connect)
            }
          }
        }
      }
    }
  }
}