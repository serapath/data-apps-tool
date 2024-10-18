# data-apps-tool
post-web data runtime  

> [!WARNING]
> Highly experimental work in progress

https://www.npmjs.com/package/data-apps-tool

# usage
`npm install -g data-apps-tool`
```bash
$ data-apps-tool portal
```
1. generates an `./index.json` file which contains an array of all valid filepaths in current folder.
2. starts a web server on port 10000
3. starts a web socket server on port 10000
4. starts a file watchter to watch all files in current directory
5. open default browser on `http://localhost:10000`
6. serves a default `index.html` file which connects to `ws://localhost:10000`
7. `index.html` loads `index.js` unless user specified a js filepath argument after `portal`
8. the executed js file can use the regular web api (see https://developer.mozilla.org/en-US/docs/Web/API),
and some additional api surface.

> [!NOTE]
> e.g. `data-apps-tool portal index.js` runs a data-apps-tool browser page which loads `index.js` with access to the full runtime api surface

# api
### `window.vault`
```js
window.vault
```
### `vault.burnthemall()`
```js
vault.burnthemall()
// resets the embedded database and deletes all data
```
### `vault.on(type, callback)`
```js
vault.on('portal', async (ws) => {
  console.log('portal', ws)
})
//
vault.on('files', async (files, version) => {
  console.log('files', files, version)
  console.log('@TODO: download and cache all files listed `files` array?')
  // @TODO: hash or stat.ctime as eTag for files ...integrity
  // => should probably be included in files as an object instead of array
})
```

