# data-apps-tool
data-apps-tool


# usage
`npm install -g data-apps-tool`
```
$ data-apps-tool portal [path/to/file.js]
```
1. generates an `./index.json` file which contains an array of all valid filepaths in current folder.
2. starts a web server on port 10000
3. starts a web socket server on port 10000
4. starts a file watchter to watch all files in current directory
5. open default browser on `http://localhost:10000`
6. serves a default `index.html` file which connects to `ws://localhost:10000`
7. `index.html` loads a user specified javascript file or else `index.js`

# api
The regular web api (see https://developer.mozilla.org/en-US/docs/Web/API),
and some additional api surface.

run `data-apps-tool portal index.js` to load `index.js` inside a data-apps-tool browser page.
The `index.js` can make use of the additional api surface.

## `vault`
`window.vault`

### `vault.burnthemall()`
resets the embedded database and deletes all data
```js
vault.burnthemall()
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

